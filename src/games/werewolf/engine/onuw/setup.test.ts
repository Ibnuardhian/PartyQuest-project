import { describe, expect, it } from "vitest";
import { deckSize, validateOnuwDeck } from "@/games/werewolf/engine/onuw/deck";
import { adjustOnuwDeck, onuwDeckRoles, ONUW_ROLE_MAX, recommendedOnuwDeck, validateOnuwNames } from "@/games/werewolf/engine/onuw/setup";

describe("ONUW setup", () => {
  it("recommends a valid N + 3 deck within limits for 3–10 players", () => {
    for (let players = 3; players <= 10; players += 1) {
      const deck = recommendedOnuwDeck(players);
      expect(deckSize(deck)).toBe(players + 3);
      expect(() => validateOnuwDeck(deck, players)).not.toThrow();
      for (const [role, count] of Object.entries(deck)) expect(count).toBeLessThanOrEqual(ONUW_ROLE_MAX[role as keyof typeof ONUW_ROLE_MAX]);
      expect(deck.MASON === undefined || deck.MASON === 2).toBe(true);
    }
    expect(recommendedOnuwDeck(3)).toEqual({ WEREWOLF: 2, SEER: 1, ROBBER: 1, TROUBLEMAKER: 1, VILLAGER: 1 });
    expect(() => recommendedOnuwDeck(11)).toThrow();
  });

  it("adjusts counts within limits, moving Masons as a pair", () => {
    expect(adjustOnuwDeck({}, "MASON", 1)).toEqual({ MASON: 2 });
    expect(adjustOnuwDeck({ MASON: 2 }, "MASON", -1)).toEqual({ MASON: 0 });
    expect(adjustOnuwDeck({ SEER: 1 }, "SEER", 1)).toEqual({ SEER: 1 });
    expect(adjustOnuwDeck({ VILLAGER: 0 }, "VILLAGER", -1)).toEqual({ VILLAGER: 0 });
  });

  it("lists every configured role once, in wake-up order", () => {
    expect(onuwDeckRoles({ VILLAGER: 2, WEREWOLF: 2, SEER: 1, TANNER: 0 })).toEqual(["WEREWOLF", "SEER", "VILLAGER"]);
  });

  it("checks pass-the-phone names", () => {
    expect(validateOnuwNames(["Alya", "Budi", "Citra"])).toBeNull();
    expect(validateOnuwNames(["Alya", " ", "Citra"])).toContain("mengisi nama");
    expect(validateOnuwNames(["Alya", "alya", "Citra"])).toContain("berbeda");
  });
});
