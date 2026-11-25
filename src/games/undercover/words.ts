import type { Category } from "@/games/undercover/contract";
import { BENDA_PAIRS, HEWAN_PAIRS, MAKANAN_PAIRS, PEKERJAAN_PAIRS, TEMPAT_PAIRS, UMUM_PAIRS, type WordPair } from "@/games/undercover/word-pairs";

export type { WordPair };

/** Pairs per themed category. "campuran" mixes these with the general (UMUM) pairs below. */
export const WORD_PAIRS: Record<Exclude<Category, "campuran">, ReadonlyArray<WordPair>> = {
  makanan: MAKANAN_PAIRS,
  hewan: HEWAN_PAIRS,
  benda: BENDA_PAIRS,
  tempat: TEMPAT_PAIRS,
  pekerjaan: PEKERJAAN_PAIRS,
};

/** General pairs (weather, nature, concepts) that belong to no themed category; only used by "campuran". */
export const GENERAL_WORD_PAIRS: ReadonlyArray<WordPair> = UMUM_PAIRS;

export function getWordPairs(category: Category): ReadonlyArray<WordPair> {
  if (category === "campuran") return [...Object.values(WORD_PAIRS).flat(), ...GENERAL_WORD_PAIRS];
  return WORD_PAIRS[category];
}
