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

  async function roomWithPlayers(count = 3, gameKey = "undercover", maxPlayers = 12) {
    const ids = [await guest()];
    const room = (await client.query<{ id: string; code: string }>(
      "select id, code from create_room($1, $2, 'Host', $3::jsonb, $4, $5)",
      [ids[0], code(), JSON.stringify({ category: "makanan", undercoverCount: 1, mrWhiteEnabled: false }), gameKey, maxPlayers],
    )).rows[0]!;
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
      await client.query("savepoint s2");
      await client.query("update game_rooms set status = 'in_progress' where id = $1", [room.id]);
      expect(await errorOf(client.query("select join_room($1, $2, 'Baru')", [await guest(), room.code]))).toContain("room_not_joinable");
      await client.query("rollback to savepoint s2");
      // A finished room (waiting for a rematch) accepts new players again.
      await client.query("update game_rooms set status = 'finished' where id = $1", [room.id]);
      const newcomer = await guest();
      const joined = await client.query("select join_room($1, $2, 'Baru')", [newcomer, room.code]);
      expect(joined.rowCount).toBe(1);
      // The newcomer can mark ready while the room waits for a rematch.
      await client.query("select set_room_ready($1, $2, true)", [room.id, newcomer]);
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

  it("allows Werewolf rooms of up to 16 players and rejects unknown games", async () => {
    await inRollback(async () => {
      const { room, ids } = await roomWithPlayers(16, "werewolf", 16);
      expect(ids).toHaveLength(16);
      const seats = await client.query<{ max: number }>("select max(seat_no) as max from room_members where room_id = $1", [room.id]);
      expect(seats.rows[0]!.max).toBe(16);
      await client.query("savepoint s");
      expect(await errorOf(client.query("select join_room($1, $2, 'Ketujuh belas')", [await guest(), room.code]))).toContain("room_full");
      await client.query("rollback to savepoint s");
      expect(await errorOf(client.query("select create_room($1, $2, 'Host', '{}'::jsonb, 'catur', 12)", [await guest(), code()]))).toContain("game_rooms_game_key_check");
    });
  });

  it("lets only the host change settings, only in the lobby, and resets other players' ready state", async () => {
    await inRollback(async () => {
      const { room, ids } = await roomWithPlayers(3);
      for (const id of ids) await client.query("select set_room_ready($1, $2, true)", [room.id, id]);
      await client.query("savepoint s");
      expect(await errorOf(client.query("select update_room_settings($1, $2, '{\"x\":1}'::jsonb)", [room.id, ids[1]]))).toContain("host_required");
      await client.query("rollback to savepoint s");
      await client.query("select update_room_settings($1, $2, '{\"x\":1}'::jsonb)", [room.id, ids[0]]);
      const settings = await client.query<{ settings: unknown }>("select settings from game_rooms where id = $1", [room.id]);
      expect(settings.rows[0]!.settings).toEqual({ x: 1 });
      const ready = await client.query<{ user_id: string; is_ready: boolean }>("select user_id, is_ready from room_members where room_id = $1 order by seat_no", [room.id]);
      expect(ready.rows.map((row) => row.is_ready)).toEqual([true, false, false]);
      await client.query("update game_rooms set status = 'in_progress' where id = $1", [room.id]);
      expect(await errorOf(client.query("select update_room_settings($1, $2, '{}'::jsonb)", [room.id, ids[0]]))).toContain("room_not_in_lobby");
    });
  });

  it("persists secret state atomically with the public state when given", async () => {
    await inRollback(async () => {
      const { session, ids, publicState } = await startedSession();
      const result = await client.query<{ ok: boolean }>(
        "select ok from apply_game_action($1, $2, 0, $3::jsonb, $4::jsonb)",
        [session.id, ids[0], JSON.stringify({ ...publicState, phase: "NIGHT_TURN" }), JSON.stringify({ votes: { a: "b" } })],
      );
      expect(result.rows[0]!.ok).toBe(true);
      const secret = await client.query<{ private_state: unknown }>("select private_state from game_private_state where session_id = $1", [session.id]);
      expect(secret.rows[0]!.private_state).toEqual({ votes: { a: "b" } });
      await client.query("select apply_game_action($1, $2, 1, $3::jsonb)", [session.id, ids[0], JSON.stringify({ ...publicState, phase: "GAME_OVER" })]);
      const after = await client.query<{ private_state: unknown }>("select private_state from game_private_state where session_id = $1", [session.id]);
      expect(after.rows[0]!.private_state).toEqual({ votes: { a: "b" } });
      const status = await client.query<{ status: string }>("select r.status from game_rooms r join game_sessions s on s.room_id = r.id where s.id = $1", [session.id]);
      expect(status.rows[0]!.status).toBe("finished");
    });
  });

  it("records presence with touch_member", async () => {
    await inRollback(async () => {
      const { room, ids } = await roomWithPlayers(3);
      await client.query("update room_members set last_seen_at = now() - interval '1 hour' where room_id = $1", [room.id]);
      await client.query("select touch_member($1, $2)", [room.id, ids[2]]);
      const online = await client.query<{ user_id: string }>("select user_id from room_members where room_id = $1 and last_seen_at > now() - interval '30 seconds'", [room.id]);
      expect(online.rows.map((row) => row.user_id)).toEqual([ids[2]]);
    });
  });

  it("pairs a TV once with a valid, unexpired code", async () => {
    await inRollback(async () => {
      const { room } = await roomWithPlayers(3);
      await client.query("insert into room_tv_pairings(room_id, pairing_code, expires_at) values ($1, '123456', now() + interval '10 minutes')", [room.id]);
      const pair = async (code: string, hash: string) => (await client.query<{ paired: boolean }>("select pair_tv_screen($1, $2, $3) as paired", [room.id, code, hash])).rows[0]!.paired;
      expect(await pair("000000", "a".repeat(64))).toBe(false);
      expect(await pair("123456", "b".repeat(64))).toBe(true);
      expect(await pair("123456", "c".repeat(64))).toBe(false);
      await client.query("insert into room_tv_pairings(room_id, pairing_code, expires_at) values ($1, '654321', now() - interval '1 minute')", [room.id]);
      expect(await pair("654321", "d".repeat(64))).toBe(false);
      const screens = await client.query("select token_hash from room_tv_screens where room_id = $1", [room.id]);
      expect(screens.rows).toEqual([{ token_hash: "b".repeat(64) }]);
    });
  });

  describe("returning to the lobby after a round", () => {
    async function finishedRoom() {
      const started = await startedSession();
      const done = await client.query("select ok from apply_game_action($1, $2, 0, $3::jsonb)", [started.session.id, started.ids[0], JSON.stringify({ ...started.publicState, phase: "finished" })]);
      expect(done.rows[0]!.ok).toBe(true);
      // Same transaction clock: age the members' lobby_at so they count as still on the result screen.
      await client.query("update room_members set lobby_at = now() - interval '1 minute' where room_id = $1", [started.room.id]);
      return started;
    }
    const statusOf = async (roomId: string) => (await client.query<{ status: string }>("select status from game_rooms where id = $1", [roomId])).rows[0]!.status;

    it("opens the lobby only after every active member is back", async () => {
      await inRollback(async () => {
        const { room, ids } = await finishedRoom();
        expect(await statusOf(room.id)).toBe("finished");
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[0]]);
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[1]]);
        expect(await statusOf(room.id)).toBe("finished");
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[2]]);
        expect(await statusOf(room.id)).toBe("lobby");
        const ready = await client.query("select count(*)::int as n from room_members where room_id = $1 and is_ready", [room.id]);
        expect(ready.rows[0]!.n).toBe(0);
      });
    });

    it("lets only the host open the lobby early and refuses it while a round runs", async () => {
      await inRollback(async () => {
        const { room, ids } = await finishedRoom();
        await client.query("savepoint s");
        expect(await errorOf(client.query("select return_to_lobby($1, $2, true)", [room.id, ids[1]]))).toContain("host_required");
        await client.query("rollback to savepoint s");
        await client.query("select return_to_lobby($1, $2, true)", [room.id, ids[0]]);
        expect(await statusOf(room.id)).toBe("lobby");
        const running = await startedSession();
        expect(await errorOf(client.query("select return_to_lobby($1, $2)", [running.room.id, running.ids[0]]))).toContain("room_in_progress");
      });
    });

    it("moves the host and opens the lobby when the host is the last one not back and leaves", async () => {
      await inRollback(async () => {
        const { room, ids } = await finishedRoom();
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[1]]);
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[2]]);
        expect(await statusOf(room.id)).toBe("finished");
        await client.query("select leave_room($1, $2)", [room.id, ids[0]]);
        expect(await statusOf(room.id)).toBe("lobby");
        const host = await client.query<{ host_user_id: string }>("select host_user_id from game_rooms where id = $1", [room.id]);
        expect(host.rows[0]!.host_user_id).toBe(ids[1]);
      });
    });

    it("treats a room everyone left as abandoned and refuses to return to it", async () => {
      await inRollback(async () => {
        const { room, ids } = await finishedRoom();
        for (const id of ids) await client.query("select leave_room($1, $2)", [room.id, id]);
        expect(await statusOf(room.id)).toBe("abandoned");
        expect(await errorOf(client.query("select return_to_lobby($1, $2)", [room.id, ids[0]]))).toContain("room_not_found");
      });
    });

    it("opens the lobby when the last member still on the result screen leaves", async () => {
      await inRollback(async () => {
        const { room, ids } = await finishedRoom();
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[0]]);
        await client.query("select return_to_lobby($1, $2)", [room.id, ids[1]]);
        expect(await statusOf(room.id)).toBe("finished");
        await client.query("select leave_room($1, $2)", [room.id, ids[2]]);
        expect(await statusOf(room.id)).toBe("lobby");
      });
    });
  });

  it("cleans up expired rooms and finished or abandoned rooms idle for over an hour", async () => {
    await inRollback(async () => {
      // updated_at is maintained by a trigger; switch it off so the test can age rooms.
      await client.query("alter table game_rooms disable trigger game_rooms_touch_updated_at");
      const make = async (status: string, updatedAgo: string, expiresIn = "10 hours") => {
        const { room } = await roomWithPlayers(1);
        await client.query(`update game_rooms set status = $2, updated_at = now() - interval '${updatedAgo}', expires_at = now() + interval '${expiresIn}' where id = $1`, [room.id, status]);
        return room.id;
      };
      const finishedOld = await make("finished", "2 hours");
      const abandonedOld = await make("abandoned", "2 hours");
      const finishedFresh = await make("finished", "10 minutes");
      const lobbyOld = await make("lobby", "5 hours");
      const inProgressOld = await make("in_progress", "5 hours");
      const expired = await make("lobby", "1 minute", "-1 minute");
      const deleted = (await client.query<{ n: number }>("select cleanup_expired_rooms() as n")).rows[0]!.n;
      expect(deleted).toBeGreaterThanOrEqual(3);
      const left = new Set((await client.query<{ id: string }>("select id from game_rooms where id = any($1)", [[finishedOld, abandonedOld, finishedFresh, lobbyOld, inProgressOld, expired]])).rows.map((row) => row.id));
      expect(left).toEqual(new Set([finishedFresh, lobbyOld, inProgressOld]));
    });
  });

  it("ignores unknown ids without leaking a session", async () => {
    const result = await client.query("select ok, error_code from apply_game_action($1, $2, 0, '{}'::jsonb)", [randomUUID(), randomUUID()]);
    expect(result.rows[0]).toEqual({ ok: false, error_code: "session_not_found" });
  });
});
