import "server-only";
import { query, queryOne } from "@/lib/db/pool";

/** Platform-level room/session persistence. Game rules live in src/games/<game>/. */

export interface RoomRow { id: string; code: string; host_user_id: string; game_key: string; status: string; settings: unknown; expires_at: Date; max_players: number }
export interface MemberRow { user_id: string; display_name: string; seat_no: number; is_ready: boolean; is_alive: boolean; online: boolean; returned: boolean }
export interface SessionRow<TPublic = unknown> { id: string; room_id: string; round_no: number; status: string; phase: string; state_version: number; public_state: TPublic }
export interface MutationResult { ok: boolean; state_version: number | null; error_code: string | null }

/** A member counts as online when seen by a lobby/view request within this window. */
export const PRESENCE_WINDOW_SECONDS = 30;

const ROOM_COLUMNS = "id, code, host_user_id, game_key, status, settings, expires_at, max_players";
const SESSION_COLUMNS = "id, room_id, round_no, status, phase, state_version, public_state";

export async function ensureGuestUser(userId: string | null) {
  if (userId) {
    const row = await queryOne<{ id: string }>(
      "insert into guest_users(id) values ($1) on conflict (id) do update set last_seen_at = now() returning id",
      [userId],
    );
    if (row) return row.id;
  }
  const created = await queryOne<{ id: string }>("insert into guest_users default values returning id");
  if (!created) throw new Error("guest_unavailable");
  return created.id;
}

export function upsertGuestProfile(userId: string, displayName: string) {
  return query(
    "insert into guest_profiles(user_id, display_name) values ($1, $2) on conflict (user_id) do update set display_name = excluded.display_name",
    [userId, displayName],
  );
}

export function findRoomByCode(code: string) {
  return queryOne<RoomRow>(`select ${ROOM_COLUMNS} from game_rooms where code = $1`, [code]);
}

export function findRoomById(roomId: string) {
  return queryOne<RoomRow>(`select ${ROOM_COLUMNS} from game_rooms where id = $1`, [roomId]);
}

export async function isActiveMember(roomId: string, userId: string) {
  const row = await queryOne<{ exists: boolean }>(
    "select exists (select 1 from room_members where room_id = $1 and user_id = $2 and left_at is null) as exists",
    [roomId, userId],
  );
  return Boolean(row?.exists);
}

export function listActiveMembers(roomId: string) {
  return query<MemberRow>(
    `select user_id, display_name, seat_no, is_ready, is_alive,
       coalesce(last_seen_at > now() - make_interval(secs => ${PRESENCE_WINDOW_SECONDS}), false) as online,
       lobby_at >= coalesce((select max(s.finished_at) from game_sessions s where s.room_id = room_members.room_id), '-infinity'::timestamptz) as returned
     from room_members where room_id = $1 and left_at is null order by seat_no`,
    [roomId],
  );
}

export function findLatestSession(roomId: string) {
  return queryOne<Omit<SessionRow, "public_state" | "room_id">>(
    "select id, round_no, status, state_version, phase from game_sessions where room_id = $1 order by round_no desc limit 1",
    [roomId],
  );
}

/** Finished rounds of a room with their stored states, oldest first, for the scoreboard. */
export function listFinishedSessions(roomId: string) {
  return query<{ public_state: unknown; private_state: unknown; settings: unknown }>(
    `select s.public_state, p.private_state, r.settings
     from game_sessions s
     join game_private_state p on p.session_id = s.id
     join game_rooms r on r.id = s.room_id
     where s.room_id = $1 and s.status = 'finished' order by s.round_no`,
    [roomId],
  );
}

export function findSession<TPublic>(sessionId: string) {
  return queryOne<SessionRow<TPublic>>(`select ${SESSION_COLUMNS} from game_sessions where id = $1`, [sessionId]);
}

export async function findSessionSecret<TSecret>(sessionId: string) {
  const row = await queryOne<{ private_state: TSecret }>("select private_state from game_private_state where session_id = $1", [sessionId]);
  return row?.private_state ?? null;
}

export function createRoom(hostUserId: string, code: string, displayName: string, settings: unknown, gameKey: string, maxPlayers: number) {
  return queryOne<RoomRow>(
    `select ${ROOM_COLUMNS} from create_room($1, $2, $3, $4::jsonb, $5, $6)`,
    [hostUserId, code, displayName, JSON.stringify(settings), gameKey, maxPlayers],
  );
}

export function updateRoomSettings(roomId: string, hostUserId: string, settings: unknown) {
  return queryOne<RoomRow>(`select ${ROOM_COLUMNS} from update_room_settings($1, $2, $3::jsonb)`, [roomId, hostUserId, JSON.stringify(settings)]);
}

/** Presence heartbeat; throttled in SQL to one write per 5 seconds per member. */
export function touchMember(roomId: string, userId: string) {
  return query("select touch_member($1, $2)", [roomId, userId]);
}

export async function listOnlineMemberIds(roomId: string) {
  const rows = await query<{ user_id: string }>(
    `select user_id from room_members where room_id = $1 and left_at is null and last_seen_at > now() - make_interval(secs => ${PRESENCE_WINDOW_SECONDS})`,
    [roomId],
  );
  return rows.map((row) => row.user_id);
}

export function joinRoom(userId: string, code: string, displayName: string) {
  return queryOne<RoomRow>(`select ${ROOM_COLUMNS} from join_room($1, $2, $3)`, [userId, code, displayName]);
}

export function setRoomReady(roomId: string, userId: string, ready: boolean) {
  return query("select set_room_ready($1, $2, $3)", [roomId, userId, ready]);
}

/** A member is back in the lobby after a round; `force` lets the host open it without waiting. Returns the room status. */
export async function returnToLobby(roomId: string, userId: string, force: boolean) {
  const row = await queryOne<{ status: string }>("select return_to_lobby($1, $2, $3) as status", [roomId, userId, force]);
  return row?.status ?? "finished";
}

export function leaveRoom(roomId: string, userId: string) {
  return query("select leave_room($1, $2)", [roomId, userId]);
}

export interface NewRound { publicState: unknown; secretState: unknown; playerPrivate: unknown }

export function startRound(roomId: string, hostUserId: string, round: NewRound) {
  return queryOne<{ id: string; state_version: number }>(
    `select id, state_version from start_game($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
    [roomId, hostUserId, JSON.stringify(round.publicState), JSON.stringify(round.secretState), JSON.stringify(round.playerPrivate)],
  );
}

/** Atomic compare-and-set: locks the session row and compares expectedVersion before persisting. */
export async function applyGameAction(sessionId: string, userId: string, expectedVersion: number, publicState: unknown, secretState?: unknown) {
  const row = await queryOne<MutationResult>(
    "select ok, state_version, error_code from apply_game_action($1, $2, $3, $4::jsonb, $5::jsonb)",
    [sessionId, userId, expectedVersion, JSON.stringify(publicState), secretState === undefined ? null : JSON.stringify(secretState)],
  );
  return row ?? { ok: false, state_version: null, error_code: "action_unavailable" };
}
