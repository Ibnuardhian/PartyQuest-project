import type { Category } from "@/games/game-contract";

export const WORD_PAIRS: Record<Exclude<Category, "campuran">, ReadonlyArray<readonly [string, string]>> = {
  makanan: [["Nasi goreng", "Mi goreng"], ["Sate ayam", "Sate kambing"], ["Es teh", "Es jeruk"]],
  hewan: [["Kelinci", "Hamster"], ["Singa", "Harimau"], ["Paus", "Lumba-lumba"]],
  benda: [["Pensil", "Pulpen"], ["Kipas angin", "AC"], ["Koper", "Ransel"]],
  tempat: [["Perpustakaan", "Toko buku"], ["Pantai", "Kolam renang"], ["Stasiun", "Terminal"]],
  pekerjaan: [["Koki", "Pembuat roti"], ["Dokter", "Perawat"], ["Pilot", "Pramugari"]],
};

export function getWordPairs(category: Category): ReadonlyArray<readonly [string, string]> {
  if (category === "campuran") return Object.values(WORD_PAIRS).flat();
  return WORD_PAIRS[category];
}
