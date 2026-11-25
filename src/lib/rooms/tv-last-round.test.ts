import { describe, expect, it } from "vitest";
import { tvShowsLastRound } from "@/lib/rooms/tv";

describe("TV stage after a round", () => {
  it("shows the round while it runs and its result once finished, but the lobby once the lobby is open again", () => {
    expect(tvShowsLastRound("in_progress")).toBe(true);
    expect(tvShowsLastRound("finished")).toBe(true);
    expect(tvShowsLastRound("lobby")).toBe(false);
  });
});
