import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { query, queryOne } from "@/lib/db/pool";

/** Shared TV screens: short-lived pairing codes traded for read-only, room-scoped tokens. */

export const TV_COOKIE_NAME = "pq_tv";
export const TV_PAIRING_MINUTES = 10;
export const TV_PRESENCE_SECONDS = 30;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newPairingCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function newTvToken() {
  return randomBytes(32).toString("base64url");
}

export function hashTvToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isTvTokenShape(token: string | undefined): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export async function createPairing(roomId: string) {
  const code = newPairingCode();
  await query(
    `insert into room_tv_pairings(room_id, pairing_code, expires_at) values ($1, $2, now() + make_interval(mins => ${TV_PAIRING_MINUTES}))
     on conflict (room_id) do update set pairing_code = excluded.pairing_code, expires_at = excluded.expires_at, created_at = now()`,
    [roomId, code],
  );
  return { code, minutes: TV_PAIRING_MINUTES };
}

export async function pairTvScreen(roomId: string, pairingCode: string) {
  const token = newTvToken();
  const row = await queryOne<{ paired: boolean }>("select pair_tv_screen($1, $2, $3) as paired", [roomId, pairingCode, hashTvToken(token)]);
  return row?.paired ? token : null;
}

/** Returns the room id a TV token belongs to (and refreshes its presence), or null. */
export async function verifyTvToken(token: string | undefined, roomId: string) {
  if (!isTvTokenShape(token)) return false;
  const row = await queryOne<{ room_id: string }>(
    "update room_tv_screens set last_seen_at = now() where token_hash = $1 and room_id = $2 returning room_id",
    [hashTvToken(token), roomId],
  );
  return Boolean(row);
}

export async function isTvConnected(roomId: string) {
  const row = await queryOne<{ connected: boolean }>(
    `select exists (select 1 from room_tv_screens where room_id = $1 and last_seen_at > now() - make_interval(secs => ${TV_PRESENCE_SECONDS})) as connected`,
    [roomId],
  );
  return Boolean(row?.connected);
}
