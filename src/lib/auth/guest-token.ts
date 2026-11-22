import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_COOKIE_NAME = "pq_guest";
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_VERSION = "v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getGuestSessionSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env.GUEST_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("GUEST_SESSION_SECRET minimal 32 karakter belum dikonfigurasi.");
  return secret;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Token format: v1.<guest uuid>.<issued-at seconds>.<HMAC-SHA256>. Holds no game data. */
export function createGuestToken(userId: string, secret: string, nowMs = Date.now()) {
  if (!UUID_PATTERN.test(userId)) throw new Error("ID tamu tidak valid.");
  const payload = `${TOKEN_VERSION}.${userId}.${Math.floor(nowMs / 1000)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyGuestToken(token: string | undefined, secret: string, nowMs = Date.now()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, userId, issuedAtRaw, signature] = parts as [string, string, string, string];
  if (version !== TOKEN_VERSION || !UUID_PATTERN.test(userId) || !/^\d{1,12}$/.test(issuedAtRaw)) return null;
  const expected = Buffer.from(sign(`${version}.${userId}.${issuedAtRaw}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const ageSeconds = Math.floor(nowMs / 1000) - Number(issuedAtRaw);
  if (ageSeconds < -60 || ageSeconds > GUEST_SESSION_MAX_AGE_SECONDS) return null;
  return { userId, issuedAt: Number(issuedAtRaw) };
}
