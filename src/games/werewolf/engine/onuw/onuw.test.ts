import { describe, expect, it } from "vitest";
import { validateOnuwDeck, validateOnuwSelections } from "@/games/werewolf/engine/onuw/deck";
import { buildOnuwNightSequence } from "@/games/werewolf/engine/onuw/night-sequence";

const deck = { WEREWOLF: 2, SEER: 1, ROBBER: 1, TROUBLEMAKER: 1, VILLAGER: 2 }; // 7 cards for 4 players

describe("ONUW deck", () => {
  it("requires exactly N + 3 cards and 3–10 players", () => {
    expect(validateOnuwDeck(deck, 4)).toEqual(deck);
    expect(() => validateOnuwDeck(deck, 5)).toThrow("tepat 8 kartu");
    expect(() => validateOnuwDeck({ WEREWOLF: 2, VILLAGER: 2 }, 2)).toThrow("3–10");
    expect(() => validateOnuwDeck({ ...deck, VILLAGER: -1, SEER: 4 }, 4)).toThrow();
  });

  it("accepts picks within the deck, leaving three cards unpicked", () => {
    expect(validateOnuwSelections(deck, ["WEREWOLF", "SEER", "VILLAGER", "VILLAGER"], 4)).toEqual({ valid: true });
    expect(validateOnuwSelections(deck, ["WEREWOLF", "WEREWOLF", "ROBBER", "TROUBLEMAKER"], 4)).toEqual({ valid: true });
  });

  it("reports every over-picked role, and a wrong number of picks", () => {
    expect(validateOnuwSelections(deck, ["SEER", "SEER", "VILLAGER", "MINION"], 4)).toEqual({
      valid: false,
      reason: "role_count",
      mismatches: [{ role: "MINION", selected: 1, available: 0 }, { role: "SEER", selected: 2, available: 1 }],
    });
    expect(validateOnuwSelections(deck, ["SEER", "VILLAGER"], 4)).toEqual({ valid: false, reason: "player_count", mismatches: [] });
  });
});

describe("ONUW night sequence", () => {
  it("calls only deck roles, in the strict wake-up order, with their pauses", () => {
    expect(buildOnuwNightSequence(deck)).toEqual([
      { key: "ONUW_START", seconds: 5 },
      { key: "WEREWOLF", seconds: 12 },
      { key: "SEER", seconds: 14 },
      { key: "ROBBER", seconds: 14 },
      { key: "TROUBLEMAKER", seconds: 14 },
      { key: "ONUW_DAY", seconds: 0 },
    ]);
  });

  it("still calls roles whose cards may be in the center", () => {
    const steps = buildOnuwNightSequence({ WEREWOLF: 2, INSOMNIAC: 1, DRUNK: 1, VILLAGER: 2, MINION: 1 }).map((step) => step.key);
    expect(steps).toEqual(["ONUW_START", "WEREWOLF", "MINION", "DRUNK", "INSOMNIAC", "ONUW_DAY"]);
  });
});
