import { describe, expect, it } from "vitest";
import { seatPositions } from "./vote-arrows";

describe("seatPositions", () => {
  it("places the first seat at the top and spreads seats evenly on the circle", () => {
    const seats = seatPositions(4);
    expect(seats[0]!.x).toBeCloseTo(340);
    expect(seats[0]!.y).toBeCloseTo(90);
    expect(seats[1]!.x).toBeCloseTo(590);
    expect(seats[2]!.y).toBeCloseTo(590);
    for (const seat of seats) expect(Math.hypot(seat.x - 340, seat.y - 340)).toBeCloseTo(250);
  });
});
