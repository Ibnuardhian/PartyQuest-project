import { ONUW_MAX_PLAYERS, ONUW_MIN_PLAYERS, ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { deckSize, ONUW_CENTER_CARDS, type OnuwDeck } from "@/games/werewolf/engine/onuw/deck";

/** Mode 2 setup helpers: deck limits, a recommended deck, and pass-the-phone name checks. Pure. */

/** Typical physical ONUW deck limits. Masons come as a pair. */
export const ONUW_ROLE_MAX: Record<OnuwRole, number> = {
  WEREWOLF: 3, MINION: 1, MASON: 2, SEER: 1, ROBBER: 1, TROUBLEMAKER: 1, DRUNK: 1, INSOMNIAC: 1, TANNER: 1, HUNTER: 1, VILLAGER: 3,
};

const RECOMMENDED_ORDER: Array<[OnuwRole, number]> = [
  ["WEREWOLF", 2], ["SEER", 1], ["ROBBER", 1], ["TROUBLEMAKER", 1], ["VILLAGER", 1], ["INSOMNIAC", 1],
  ["MINION", 1], ["DRUNK", 1], ["MASON", 2], ["TANNER", 1], ["HUNTER", 1], ["VILLAGER", 1], ["VILLAGER", 1],
];

/** A balanced deck of exactly N + 3 cards for N players (3–10). */
export function recommendedOnuwDeck(playerCount: number): OnuwDeck {
  if (!Number.isInteger(playerCount) || playerCount < ONUW_MIN_PLAYERS || playerCount > ONUW_MAX_PLAYERS) throw new Error(`ONUW memerlukan ${ONUW_MIN_PLAYERS}–${ONUW_MAX_PLAYERS} pemain.`);
  const target = playerCount + ONUW_CENTER_CARDS;
  const deck: OnuwDeck = {};
  for (const [role, count] of RECOMMENDED_ORDER) {
    const size = deckSize(deck);
    if (size >= target) break;
    // Masons only come as a pair; skip them when there is room for just one card.
    if (role === "MASON" && target - size < 2) continue;
    deck[role] = (deck[role] ?? 0) + Math.min(count, target - size);
  }
  return deck;
}

/** Changes one role count within its limit; Masons move as a pair (0 or 2). */
export function adjustOnuwDeck(deck: OnuwDeck, role: OnuwRole, delta: 1 | -1): OnuwDeck {
  const current = deck[role] ?? 0;
  const step = role === "MASON" ? 2 : 1;
  const next = Math.max(0, Math.min(ONUW_ROLE_MAX[role], current + delta * step));
  return { ...deck, [role]: next };
}

/** Roles in the deck, in wake-up/display order, each once (shown at full opacity to every player). */
export function onuwDeckRoles(deck: OnuwDeck): OnuwRole[] {
  return ONUW_ROLES.filter((role) => (deck[role] ?? 0) > 0);
}

/** Returns an Indonesian error message, or null when the registered names are usable. */
export function validateOnuwNames(names: readonly string[]): string | null {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.some((name) => name.length === 0)) return "Setiap pemain harus mengisi nama.";
  if (trimmed.some((name) => name.length > 24)) return "Nama maksimal 24 karakter.";
  if (new Set(trimmed.map((name) => name.toLocaleLowerCase("id-ID"))).size !== trimmed.length) return "Nama pemain harus berbeda.";
  return null;
}
