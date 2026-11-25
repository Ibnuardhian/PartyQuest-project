/**
 * Fake Tap layout (docs/03 §2.2): a grid that looks like the real target picker (one tile per player another
 * player could be picking), but every tile shows only a number. Players outside their turn tap 1, 2, 3...
 * in order, so a glance at the screen cannot tell who is really acting.
 */

export interface TapGrid {
  /** Tile labels in grid order: a shuffled 1..size. */
  tiles: number[];
  /** Tap 1..goal in order to finish a round. */
  goal: number;
}

export const FAKE_TAP_MIN_TILES = 3;
export const FAKE_TAP_MAX_TILES = 16;

/** `size` follows the number of targets the real picker would show; `goal` is 3 or 4 taps per round. */
export function makeTapGrid(size: number, random: () => number): TapGrid {
  const count = Math.max(FAKE_TAP_MIN_TILES, Math.min(FAKE_TAP_MAX_TILES, Math.round(size)));
  const tiles = Array.from({ length: count }, (_, index) => index + 1);
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [tiles[index], tiles[swap]] = [tiles[swap]!, tiles[index]!];
  }
  return { tiles, goal: Math.min(count, random() < 0.5 ? 3 : 4) };
}
