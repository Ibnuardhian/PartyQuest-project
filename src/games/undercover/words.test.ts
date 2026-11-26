import { describe, expect, it } from "vitest";
import { undercoverGame } from "@/games/undercover/engine";
import type { Category, GameSettings } from "@/games/undercover/contract";
import { countWordPairs, GENERAL_WORD_PAIRS, getWordPairs, WORD_PAIRS } from "@/games/undercover/words";

const THEMED = Object.keys(WORD_PAIRS) as Array<Exclude<Category, "campuran">>;
const pairKey = ([a, b]: readonly [string, string]) => [a, b].map((word) => word.toLocaleLowerCase("id-ID")).sort().join("|");
const allPairs = [...THEMED.flatMap((category) => WORD_PAIRS[category]), ...GENERAL_WORD_PAIRS];

describe("Undercover word library", () => {
  it("has the curated 25 pairs in every themed category and in the general set (150 in total)", () => {
    for (const category of THEMED) expect(WORD_PAIRS[category].length, category).toBe(25);
    expect(GENERAL_WORD_PAIRS.length).toBe(25);
    expect(allPairs).toHaveLength(150);
  });

  it("contains clean pairs: two different, trimmed words that fit the guess limit", () => {
    for (const [a, b] of allPairs) {
      expect(a, `${a} / ${b}`).toBe(a.trim());
      expect(b, `${a} / ${b}`).toBe(b.trim());
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
      expect(a.length).toBeLessThanOrEqual(40);
      expect(b.length).toBeLessThanOrEqual(40);
      expect(a.toLocaleLowerCase("id-ID"), `${a} / ${b}`).not.toBe(b.toLocaleLowerCase("id-ID"));
    }
  });

  it("has no duplicate pair anywhere in the library, in either order", () => {
    const seen = new Map<string, number>();
    for (const pair of allPairs) seen.set(pairKey(pair), (seen.get(pairKey(pair)) ?? 0) + 1);
    expect([...seen].filter(([, count]) => count > 1).map(([key]) => key)).toEqual([]);
  });

  it("mixes every category and the general pairs for 'campuran'", () => {
    expect(getWordPairs("campuran")).toHaveLength(allPairs.length);
    for (const category of THEMED) expect(getWordPairs(category)).toBe(WORD_PAIRS[category]);
  });
});

describe("category word counts", () => {
  it("counts the pairs that can actually be drawn, with campuran as the whole pool", () => {
    for (const category of THEMED) expect(countWordPairs(category)).toBe(WORD_PAIRS[category].length);
    expect(countWordPairs("campuran")).toBe(THEMED.reduce((sum, category) => sum + countWordPairs(category), 0) + GENERAL_WORD_PAIRS.length);
  });
});

describe("word assignment", () => {
  const settings: GameSettings = { category: "makanan", undercoverCount: 1, mrWhiteEnabled: false };
  const names = ["Alya", "Bima", "Citra"];
  const pairs = getWordPairs("makanan");

  /** Random source that picks the first pair and answers the swap draw (the one right after it) with `swap`. */
  function source(swap: 0 | 1) {
    let afterPair = false;
    return (max: number) => {
      if (afterPair) { afterPair = false; return swap % max; }
      if (max === pairs.length) { afterPair = true; return 0; }
      return 0;
    };
  }

  it("lets either word of the pair be the civilian word", () => {
    const [first, second] = pairs[0]!;
    const kept = undercoverGame.createInitialState(names, settings, source(0));
    expect(kept.secret).toMatchObject({ civilianWord: first, undercoverWord: second });
    const swapped = undercoverGame.createInitialState(names, settings, source(1));
    expect(swapped.secret).toMatchObject({ civilianWord: second, undercoverWord: first });
    expect(swapped.secret.assignments.filter((item) => item.role === "civilian").every((item) => item.word === second)).toBe(true);
    expect(swapped.secret.assignments.find((item) => item.role === "undercover")?.word).toBe(first);
  });

  it("always gives civilians and the undercover the two different words of one library pair", () => {
    for (let round = 0; round < 40; round += 1) {
      const state = undercoverGame.createInitialState(names, { ...settings, category: "campuran" });
      const { civilianWord, undercoverWord } = state.secret;
      expect(civilianWord).not.toBe(undercoverWord);
      expect(getWordPairs("campuran").some(([a, b]) => (a === civilianWord && b === undercoverWord) || (a === undercoverWord && b === civilianWord))).toBe(true);
    }
  });
});
