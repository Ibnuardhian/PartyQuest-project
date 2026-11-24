import { describe, expect, it } from "vitest";
import type { OnuwRole } from "@/games/werewolf/contract";
import type { OnuwDeck } from "./deck";
import { onuwCenterCards, onuwFinalCardOptions, onuwFinalCardPool, validOnuwFinalCards } from "./final-cards";

// 3 players + 3 center cards.
const deck: OnuwDeck = { WEREWOLF: 2, SEER: 1, ROBBER: 1, VILLAGER: 1, DRUNK: 1 };

describe("ONUW final cards", () => {
  it("without a dealt Drunk, hands can only hold the dealt cards", () => {
    const dealt: OnuwRole[] = ["ROBBER", "VILLAGER", "SEER"];
    expect(onuwCenterCards(deck, dealt)).toEqual({ WEREWOLF: 2, DRUNK: 1 });
    expect(onuwFinalCardPool(deck, dealt)).toEqual({ ROBBER: 1, VILLAGER: 1, SEER: 1 });
    expect(validOnuwFinalCards(deck, dealt, ["VILLAGER", "ROBBER", "SEER"])).toBe(true);
    expect(validOnuwFinalCards(deck, dealt, ["WEREWOLF", "VILLAGER", "SEER"])).toBe(false);
  });

  it("removes options already taken by other players", () => {
    const dealt: OnuwRole[] = ["ROBBER", "VILLAGER", "SEER"];
    expect(onuwFinalCardOptions(deck, dealt, ["ROBBER", "VILLAGER", null], 2)).toEqual(["SEER"]);
    // A player's own current pick stays available.
    expect(onuwFinalCardOptions(deck, dealt, ["ROBBER", "VILLAGER", "SEER"], 0)).toEqual(["ROBBER"]);
  });

  it("with a dealt Drunk, exactly one center card may enter the hands", () => {
    const dealt: OnuwRole[] = ["DRUNK", "VILLAGER", "SEER"];
    expect(onuwFinalCardPool(deck, dealt)).toEqual({ DRUNK: 1, VILLAGER: 1, SEER: 1, WEREWOLF: 2, ROBBER: 1 });
    expect(validOnuwFinalCards(deck, dealt, ["WEREWOLF", "VILLAGER", "SEER"])).toBe(true);
    expect(validOnuwFinalCards(deck, dealt, ["WEREWOLF", "WEREWOLF", "SEER"])).toBe(false);
    expect(validOnuwFinalCards(deck, dealt, ["DRUNK", "VILLAGER", "SEER"])).toBe(true);
  });
});
