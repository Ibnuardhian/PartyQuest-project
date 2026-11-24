import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit per window, per key", () => {
    const limiter = new RateLimiter(3, 60_000);
    const start = 1_000_000;
    expect([0, 1, 2, 3].map((offset) => limiter.allow("room-a", start + offset))).toEqual([true, true, true, false]);
    expect(limiter.allow("room-b", start + 4)).toBe(true);
  });

  it("frees capacity as the window slides", () => {
    const limiter = new RateLimiter(2, 1_000);
    expect(limiter.allow("k", 0)).toBe(true);
    expect(limiter.allow("k", 10)).toBe(true);
    expect(limiter.allow("k", 500)).toBe(false);
    expect(limiter.allow("k", 1_001)).toBe(true);
  });
});
