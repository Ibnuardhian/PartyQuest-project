import { describe, expect, it } from "vitest";
import type { OnuwRole } from "@/games/werewolf/contract";
import type { OnuwDeck } from "@/games/werewolf/engine/onuw/deck";
import { nextOnuwQuestion, onuwKnownCards, onuwVerdict, resolveOnuwFacts } from "@/games/werewolf/engine/onuw/verdict";
import { onuwOutcome } from "@/games/werewolf/engine/onuw/winner";

const in_ = { werewolfInPlay: true, minionInPlay: true };
const out = { werewolfInPlay: false, minionInPlay: false };

describe("onuwVerdict (dead cards only)", () => {
  it("the village wins when a dead card is a Werewolf, even if the facts say none", () => {
    expect(onuwVerdict(["WEREWOLF"], out)).toMatchObject({ villageWins: true, werewolfWins: false });
    expect(onuwVerdict(["SEER", "WEREWOLF"], in_)).toMatchObject({ villageWins: true, werewolfWins: false });
  });

  it("the Werewolf team wins when a Werewolf is in play and none, nor the Tanner, died (also with no deaths)", () => {
    expect(onuwVerdict(["SEER"], in_)).toMatchObject({ villageWins: false, werewolfWins: true });
    expect(onuwVerdict([], in_)).toMatchObject({ werewolfWins: true });
  });

  it("a dead Tanner wins alone, denies the Werewolf team, and shares with the village if a Werewolf also died", () => {
    expect(onuwVerdict(["TANNER"], in_)).toMatchObject({ tannerWins: true, villageWins: false, werewolfWins: false });
    expect(onuwVerdict(["TANNER", "WEREWOLF"], in_)).toMatchObject({ tannerWins: true, villageWins: true });
  });

  it("with no Werewolf in play, the village wins on no deaths or only Minion deaths, and a living Minion wins otherwise", () => {
    expect(onuwVerdict([], out)).toMatchObject({ villageWins: true, werewolfWins: false });
    expect(onuwVerdict(["MINION"], { werewolfInPlay: false, minionInPlay: false })).toMatchObject({ villageWins: true });
    expect(onuwVerdict(["SEER"], { werewolfInPlay: false, minionInPlay: true })).toMatchObject({ villageWins: false, werewolfWins: true });
    expect(onuwVerdict(["SEER"], out)).toMatchObject({ villageWins: false, werewolfWins: false });
  });

  it("agrees with the full-table outcome for every choice of dead players", () => {
    const table: OnuwRole[] = ["WEREWOLF", "MINION", "SEER", "TANNER", "HUNTER", "VILLAGER"];
    for (let mask = 0; mask < 1 << table.length; mask += 1) {
      const dead = table.flatMap((_, index) => (mask >> index) & 1 ? [index] : []);
      const full = onuwOutcome(table, dead);
      const verdict = onuwVerdict(dead.map((index) => table[index]!), { werewolfInPlay: true, minionInPlay: true });
      expect(verdict, `dead ${dead}`).toMatchObject({ villageWins: full.villageWins, werewolfWins: full.werewolfWins, tannerWins: full.tannerWins });
    }
  });
});

describe("what the app can work out without asking", () => {
  const deck = (counts: Partial<Record<OnuwRole, number>>): OnuwDeck => counts as OnuwDeck;
  const withCenter = deck({ WEREWOLF: 2, SEER: 1, ROBBER: 1, VILLAGER: 2, MINION: 1 });

  it("without a Drunk the hands are the dealt cards, so nothing is asked", () => {
    const known = onuwKnownCards(withCenter, ["WEREWOLF", "SEER", "ROBBER", "VILLAGER", "VILLAGER"], []);
    expect(known).toEqual({ WEREWOLF: true, MINION: false });
    expect(nextOnuwQuestion(known, {})).toBeNull();
    expect(resolveOnuwFacts(known, {})).toEqual({ werewolfInPlay: true, minionInPlay: false });
  });

  it("a Werewolf that is only in the center stays out of play without a Drunk", () => {
    const known = onuwKnownCards(deck({ WEREWOLF: 1, SEER: 1, VILLAGER: 4 }), ["SEER", "VILLAGER", "VILLAGER", "VILLAGER"], []);
    expect(known.WEREWOLF).toBe(false);
  });

  it("with a Drunk a single dealt Werewolf might have left, so the Werewolf question is asked, then the Minion", () => {
    const dealt: OnuwRole[] = ["WEREWOLF", "DRUNK", "SEER", "VILLAGER", "VILLAGER"];
    const known = onuwKnownCards(deck({ WEREWOLF: 1, DRUNK: 1, SEER: 1, VILLAGER: 2, MINION: 1, ROBBER: 1 }), dealt, []);
    expect(known).toEqual({ WEREWOLF: null, MINION: null });
    expect(nextOnuwQuestion(known, {})).toBe("WEREWOLF");
    expect(nextOnuwQuestion(known, { WEREWOLF: true })).toBeNull();
    expect(nextOnuwQuestion(known, { WEREWOLF: false })).toBe("MINION");
    expect(nextOnuwQuestion(known, { WEREWOLF: false, MINION: false })).toBeNull();
  });

  it("with a Drunk two dealt copies cannot both leave, and a dead card settles it", () => {
    const dealt: OnuwRole[] = ["WEREWOLF", "WEREWOLF", "DRUNK", "SEER", "VILLAGER"];
    expect(onuwKnownCards(deck({ WEREWOLF: 2, DRUNK: 1, SEER: 1, VILLAGER: 3 }), dealt, []).WEREWOLF).toBe(true);
    expect(onuwKnownCards(deck({ WEREWOLF: 1, DRUNK: 1, SEER: 1, VILLAGER: 3 }), ["WEREWOLF", "DRUNK", "SEER", "VILLAGER"], ["WEREWOLF"]).WEREWOLF).toBe(true);
  });
});
