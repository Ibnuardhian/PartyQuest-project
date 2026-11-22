import { describe, expect, it } from "vitest";
import { makeTapSequence } from "@/games/werewolf/ui/fake-tap-layout";

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

describe("Fake Tap layout", () => {
  it("places 3–4 numbered circles inside the area without overlap", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const targets = makeTapSequence(seeded(seed));
      expect(targets.length === 3 || targets.length === 4).toBe(true);
      expect(targets.map((target) => target.number)).toEqual(targets.map((_, index) => index + 1));
      for (const target of targets) {
        expect(target.x).toBeGreaterThanOrEqual(12);
        expect(target.x).toBeLessThanOrEqual(88);
        expect(target.y).toBeGreaterThanOrEqual(14);
        expect(target.y).toBeLessThanOrEqual(86);
      }
      for (const a of targets) for (const b of targets) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(24);
    }
  });
});
