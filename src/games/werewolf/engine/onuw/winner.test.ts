import { describe, expect, it } from "vitest";
import type { OnuwRole } from "@/games/werewolf/contract";
import { onuwOutcome, pendingHunters } from "./winner";

const table: OnuwRole[] = ["WEREWOLF", "MINION", "SEER", "TANNER", "HUNTER"];

describe("onuwOutcome", () => {
  it("village wins when a Werewolf dies, including dead villagers", () => {
    const outcome = onuwOutcome(table, [0, 4]);
    expect(outcome).toMatchObject({ villageWins: true, werewolfWins: false, tannerWins: false });
    expect(outcome.winners).toEqual([2, 4]);
  });

  it("Werewolf team wins when no Werewolf and no Tanner dies", () => {
    const outcome = onuwOutcome(table, [2]);
    expect(outcome).toMatchObject({ villageWins: false, werewolfWins: true });
    expect(outcome.winners).toEqual([0, 1]);
  });

  it("Werewolf team wins when nobody dies but a Werewolf is in play", () => {
    expect(onuwOutcome(table, []).winners).toEqual([0, 1]);
  });

  it("a dead Tanner wins alone and blocks the Werewolf win", () => {
    const outcome = onuwOutcome(table, [3]);
    expect(outcome).toMatchObject({ villageWins: false, werewolfWins: false, tannerWins: true });
    expect(outcome.winners).toEqual([3]);
  });

  it("Tanner and village both win when both a Tanner and a Werewolf die", () => {
    expect(onuwOutcome(table, [0, 3]).winners).toEqual([2, 3, 4]);
  });

  it("with no Werewolf among players, the village wins only if nobody (or only a Minion) dies", () => {
    const noWolves: OnuwRole[] = ["SEER", "ROBBER", "MINION", "VILLAGER"];
    expect(onuwOutcome(noWolves, []).winners).toEqual([0, 1, 3]);
    expect(onuwOutcome(noWolves, [2]).winners).toEqual([0, 1, 3]);
    expect(onuwOutcome(noWolves, [0])).toMatchObject({ villageWins: false, werewolfWins: true, winners: [2] });
  });

  it("with no Werewolf and no Minion, a death means nobody wins", () => {
    expect(onuwOutcome(["SEER", "ROBBER", "VILLAGER"], [1])).toMatchObject({ villageWins: false, werewolfWins: false, winners: [] });
  });

  it("counts the final card, not the card dealt at the start", () => {
    // The Robber took the Werewolf card: the player now holding WEREWOLF is a werewolf.
    expect(onuwOutcome(["VILLAGER", "WEREWOLF", "SEER"], [1]).winners).toEqual([0, 2]);
  });
});

describe("pendingHunters", () => {
  it("asks each dead Hunter once", () => {
    const roles: OnuwRole[] = ["HUNTER", "SEER", "HUNTER"];
    expect(pendingHunters(roles, [0, 1], [])).toEqual([0]);
    expect(pendingHunters(roles, [0, 1, 2], [0])).toEqual([2]);
    expect(pendingHunters(roles, [0, 2], [0, 2])).toEqual([]);
  });
});
