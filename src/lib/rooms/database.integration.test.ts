import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Exercises the PL/pgSQL room functions against a real PostgreSQL (Compose `postgres`).
 * Skipped when DATABASE_URL is not set. Each test runs in a transaction that is rolled back,
 * except the NOTIFY test, which must commit and deletes its rows afterwards.
 */
// Mirror src/lib/db/pool.ts: bigint columns are read as numbers.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("PostgreSQL room functions", () => {
  let client: pg.Client;

  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { env: process.env, stdio: "pipe" });
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
  });
  afterAll(async () => { await client?.end(); });

  async function inRollback(fn: () => Promise<void>) {
    await client.query("begin");
    try { await fn(); } finally { await client.query("rollback"); }
  }

  async function guest() {
    return (await client.query<{ id: string }>("insert into guest_users default values returning id")).rows[0]!.id;
  }

  const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

  async function roomWithPlayers(count = 3) {
    const ids = [await guest()];
    const room = (await client.query<{ id: string; code: string }>("select id, code from create_room($1, $2, 'Host', $3::jsonb)", [ids[0], code(), JSON.stringify({ category: "makanan", undercoverCount: 1, mrWhiteEnabled: false })])).rows[0]!;
    for (let index = 1; index < count; index += 1) {
      const id = await guest();
      ids.push(id);
      await client.query("select join_room($1, $2, $3)", [id, room.code, `Pemain ${index}`]);
    }
    return { room, ids };
  }

  async function startedSession(count = 3) {
    const { room, ids } = await roomWithPlayers(count);
    for (const id of ids) await client.query("select set_room_ready($1, $2, true)", [room.id, id]);
    const players = ids.map((id) => ({ id, name: id.slice(0, 4), alive: true }));
    const publicState = { phase: "reveal", players };
    const assignments = ids.map((id) => ({ playerId: id, role: "civilian", word: "Kopi" }));
    const session = (await client.query<{ id: string; state_version: number }>(
      "select id, state_version from start_game($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)",
      [room.id, ids[0], JSON.stringify(publicState), JSON.stringify({ assignments }), JSON.stringify(assignments)],
    )).rows[0]!;
    return { room, ids, session, publicState };
  }

  const errorOf = (promise: Promise<unknown>) => promise.then(() => null, (error: Error) => error.message);

  it("rejects duplicate names, full rooms, and joins after start", async () => {
    await inRollback(async () => {
      const { room } = await roomWithPlayers(2);
      await client.query("savepoint s");
      expect(await errorOf(client.query("select join_room($1, $2, 'pemain 1')", [await guest(), room.code]))).toContain("duplicate_name");
      await client.query("rollback to savepoint s");
      await client.query("update game_rooms set status = 'in_progress' where id = $1", [room.id]);
      expect(await errorOf(client.query("select join_room($1, $2, 'Baru')", [await guest(), room.code]))).toContain("room_not_joinable");
    });
  });

  it("only lets the host start, and only when everyone is ready", async () => {
    await inRollback(async () => {
      const { room, ids } = await roomWithPlayers(3);
      const state = JSON.stringify({ phase: "reveal", players: ids.map((id) => ({ id, alive: true })) });
      await client.query("savepoint s");
      expect(await errorOf(client.query("select start_game($1, $2, $3::jsonb, '{}'::jsonb, '[]'::jsonb)", [room.id, ids[1], state]))).toContain("host_required");
      await client.query("rollback to savepoint s");
      expect(await errorOf(client.query("select start_game($1, $2, $3::jsonb, '{}'::jsonb, '[]'::jsonb)", [room.id, ids[0], state]))).toContain("players_not_ready");
    });
  });

  it("applies actions with compare-and-set versioning and membership checks", async () => {
    await inRollback(async () => {
      const { session, ids, publicState } = await startedSession();
      const apply = async (userId: string, expected: number) => (await client.query<{ ok: boolean; state_version: number | null; error_code: string | null }>(
        "select ok, state_version, error_code from apply_game_action($1, $2, $3, $4::jsonb)", [session.id, userId, expected, JSON.stringify({ ...publicState, phase: "clue" })],
      )).rows[0]!;
      expect(await apply(ids[1]!, 0)).toEqual({ ok: true, state_version: 1, error_code: null });
      expect(await apply(ids[2]!, 0)).toEqual({ ok: false, state_version: 1, error_code: "version_conflict" });
      expect(await apply(await guest(), 1)).toEqual({ ok: false, state_version: 1, error_code: "not_a_member" });
    });
  });

  it("keeps members seated during a round and stores private state per player", async () => {
    await inRollback(async () => {
      const { room, ids, session } = await startedSession();
      const rows = await client.query("select user_id from player_private_state where session_id = $1", [session.id]);
      expect(rows.rowCount).toBe(3);
      expect(await errorOf(client.query("select leave_room($1, $2)", [room.id, ids[1]]))).toContain("room_in_progress");
    });
  });

  it("emits a room-id-only NOTIFY after a committed change", async () => {
    const listener = new pg.Client({ connectionString: databaseUrl });
    await listener.connect();
    const { room, ids } = await roomWithPlayers(2);
    try {
      await listener.query("listen partyquest_room_changed");
      const received = new Promise<string | undefined>((resolve) => listener.once("notification", (message) => resolve(message.payload)));
      await client.query("select set_room_ready($1, $2, true)", [room.id, ids[1]]);
      expect(await received).toBe(room.id);
    } finally {
      await client.query("delete from guest_users where id = any($1::uuid[])", [ids]);
      await listener.end();
    }
  });

  it("ignores unknown ids without leaking a session", async () => {
    const result = await client.query("select ok, error_code from apply_game_action($1, $2, 0, '{}'::jsonb)", [randomUUID(), randomUUID()]);
    expect(result.rows[0]).toEqual({ ok: false, error_code: "session_not_found" });
  });
});
