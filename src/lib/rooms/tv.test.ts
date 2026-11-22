import { describe, expect, it } from "vitest";
import { hashTvToken, isTvTokenShape, newPairingCode, newTvToken } from "@/lib/rooms/tv";

describe("TV pairing helpers", () => {
  it("creates 6-digit pairing codes and random 256-bit tokens", () => {
    for (let index = 0; index < 50; index += 1) expect(newPairingCode()).toMatch(/^[0-9]{6}$/);
    const tokens = new Set(Array.from({ length: 50 }, () => newTvToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(isTvTokenShape(token)).toBe(true);
  });

  it("stores only a SHA-256 hash of the token", () => {
    const token = newTvToken();
    expect(hashTvToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashTvToken(token)).toBe(hashTvToken(token));
    expect(hashTvToken(token)).not.toContain(token);
  });

  it("rejects malformed cookie values before touching the database", () => {
    for (const bad of [undefined, "", "abc", "x".repeat(43) + "!", "a b"]) expect(isTvTokenShape(bad)).toBe(false);
  });
});
