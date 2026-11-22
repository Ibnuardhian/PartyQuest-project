// Applies db/migrations/*.sql in filename order, each in its own transaction, once.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diatur.");
  process.exit(1);
}

const migrationsDir = path.resolve(import.meta.dirname, "..", "db", "migrations");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  // Serialize concurrent runners (for example several containers starting at once).
  await client.query("select pg_advisory_lock(hashtext('partyquest_migrations'))");
  await client.query(`create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const { rows } = await client.query("select name from public.schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations(name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${file} gagal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log("migrations up to date");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
