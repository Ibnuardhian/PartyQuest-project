import { describe, expect, it } from "vitest";
import { qrModules } from "./qr-code";

describe("qrModules", () => {
  it("encodes a room link into a square code with finder patterns", () => {
    const { size, cells } = qrModules("https://partyquest.example/room/ABC123");
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
    const dark = new Set(cells.map(([x, y]) => `${x},${y}`));
    // Corners of the three finder patterns are always dark.
    for (const corner of ["0,0", `${size - 1},0`, `0,${size - 1}`]) expect(dark.has(corner)).toBe(true);
  });
});
