import { describe, expect, it } from "vitest";
import { FAKE_TAP_MAX_TILES, FAKE_TAP_MIN_TILES, makeTapGrid } from "@/games/werewolf/ui/fake-tap-layout";

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

describe("Fake Tap grid", () => {
  it("has one numbered tile per target the real picker would show, in shuffled order", () => {
    let shuffled = false;
    for (let seed = 1; seed <= 200; seed += 1) {
      const size = 3 + (seed % 12);
      const grid = makeTapGrid(size, seeded(seed));
      expect(grid.tiles).toHaveLength(size);
      expect([...grid.tiles].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, index) => index + 1));
      expect(grid.goal === 3 || grid.goal === 4).toBe(true);
      expect(grid.goal).toBeLessThanOrEqual(size);
      if (grid.tiles.some((number, index) => number !== index + 1)) shuffled = true;
    }
    expect(shuffled).toBe(true);
  });

  it("keeps the grid between 3 and 16 tiles", () => {
    expect(makeTapGrid(0, seeded(1)).tiles).toHaveLength(FAKE_TAP_MIN_TILES);
    expect(makeTapGrid(99, seeded(1)).tiles).toHaveLength(FAKE_TAP_MAX_TILES);
  });
});
