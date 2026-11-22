import { describe, expect, it } from "vitest";
import { createGuestToken, getGuestSessionSecret, GUEST_SESSION_MAX_AGE_SECONDS, verifyGuestToken } from "@/lib/auth/guest-token";

const secret = "test-secret-that-is-at-least-32-characters";
const userId = "3f1c2b9e-8a4d-4c1e-9f2a-1b2c3d4e5f60";
const now = Date.UTC(2026, 10, 22);

describe("guest session token", () => {
  it("round-trips a signed guest id", () => {
    expect(verifyGuestToken(createGuestToken(userId, secret, now), secret, now)).toEqual({ userId, issuedAt: now / 1000 });
  });

  it("rejects a swapped guest id, tampered signature, or different secret", () => {
    const token = createGuestToken(userId, secret, now);
    const otherId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    expect(verifyGuestToken(token.replace(userId, otherId), secret, now)).toBeNull();
    expect(verifyGuestToken(`${token.slice(0, -2)}xx`, secret, now)).toBeNull();
    expect(verifyGuestToken(token, `${secret}-rotated`, now)).toBeNull();
  });

  it("rejects expired, future-dated, and malformed tokens", () => {
    const token = createGuestToken(userId, secret, now);
    expect(verifyGuestToken(token, secret, now + (GUEST_SESSION_MAX_AGE_SECONDS + 1) * 1000)).toBeNull();
    expect(verifyGuestToken(createGuestToken(userId, secret, now + 3_600_000), secret, now)).toBeNull();
    for (const bad of [undefined, "", "v1.abc", `v2.${userId}.1.sig`, "a.b.c.d.e"]) expect(verifyGuestToken(bad, secret, now)).toBeNull();
  });

  it("refuses to sign non-uuid ids and requires a strong secret", () => {
    expect(() => createGuestToken("not-a-uuid", secret, now)).toThrow();
    expect(() => getGuestSessionSecret({ GUEST_SESSION_SECRET: "short" })).toThrow();
    expect(() => getGuestSessionSecret({})).toThrow();
    expect(getGuestSessionSecret({ GUEST_SESSION_SECRET: secret })).toBe(secret);
  });
});
