import { ONUW_MAX_PLAYERS, ONUW_MIN_PLAYERS, ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";

/** Mode 2 deck rules (docs/02 §3.1): N players, N + 3 physical cards, 3 stay in the center. */

export type OnuwDeck = Partial<Record<OnuwRole, number>>;
export const ONUW_CENTER_CARDS = 3;

export function deckSize(deck: OnuwDeck) {
  return ONUW_ROLES.reduce((sum, role) => sum + (deck[role] ?? 0), 0);
}

export function validateOnuwDeck(deck: OnuwDeck, playerCount: number): OnuwDeck {
  if (!Number.isInteger(playerCount) || playerCount < ONUW_MIN_PLAYERS || playerCount > ONUW_MAX_PLAYERS) {
    throw new Error(`ONUW memerlukan ${ONUW_MIN_PLAYERS}–${ONUW_MAX_PLAYERS} pemain.`);
  }
  for (const [role, count] of Object.entries(deck)) {
    if (!(ONUW_ROLES as readonly string[]).includes(role)) throw new Error("Deck berisi role yang tidak dikenal.");
    if (!Number.isInteger(count) || (count ?? 0) < 0) throw new Error("Jumlah kartu harus bilangan bulat positif.");
  }
  if (deckSize(deck) !== playerCount + ONUW_CENTER_CARDS) throw new Error(`Deck harus berisi tepat ${playerCount + ONUW_CENTER_CARDS} kartu (jumlah pemain + 3).`);
  return Object.fromEntries(Object.entries(deck).filter(([, count]) => (count ?? 0) > 0)) as OnuwDeck;
}

export interface OnuwMismatch { role: OnuwRole; selected: number; available: number }
export type OnuwSelectionResult =
  | { valid: true }
  | { valid: false; reason: "player_count"; mismatches: [] }
  | { valid: false; reason: "role_count"; mismatches: OnuwMismatch[] };

/**
 * Pass-the-phone check: valid iff ΣS(r) = N and S(r) ≤ D(r) for every role.
 * On failure, names are kept by the caller and only roles are picked again.
 */
export function validateOnuwSelections(deck: OnuwDeck, selections: readonly OnuwRole[], playerCount: number): OnuwSelectionResult {
  if (selections.length !== playerCount) return { valid: false, reason: "player_count", mismatches: [] };
  const selected = new Map<OnuwRole, number>();
  for (const role of selections) selected.set(role, (selected.get(role) ?? 0) + 1);
  const mismatches = ONUW_ROLES
    .map((role) => ({ role, selected: selected.get(role) ?? 0, available: deck[role] ?? 0 }))
    .filter((item) => item.selected > item.available);
  return mismatches.length > 0 ? { valid: false, reason: "role_count", mismatches } : { valid: true };
}
