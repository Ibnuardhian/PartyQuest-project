import "server-only";
import pg from "pg";

// int8 (count(*), state_version) is returned as a string by default; versions stay far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

const globalForDb = globalThis as typeof globalThis & { __partyquestPool?: pg.Pool };

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum dikonfigurasi.");
  return url;
}

export function getPool() {
  globalForDb.__partyquestPool ??= new pg.Pool({ connectionString: getDatabaseUrl(), max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  return globalForDb.__partyquestPool;
}

export async function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return (await getPool().query<T>(text, values)).rows;
}

export async function queryOne<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return (await query<T>(text, values))[0] ?? null;
}

/** Extracts the message of a PL/pgSQL `raise exception` or a constraint error. */
export function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const constraint = (error as Error & { constraint?: string }).constraint;
    return constraint ? `${error.message} (${constraint})` : error.message;
  }
  return String(error);
}

export function isDatabaseError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as Error & { code?: unknown }).code === "string";
}
