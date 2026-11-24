import { ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import type { OnuwDeck } from "@/games/werewolf/engine/onuw/deck";

type Counts = Partial<Record<OnuwRole, number>>;

function countRoles(roles: readonly OnuwRole[]): Counts {
  const counts: Counts = {};
  for (const role of roles) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

/** Cards left in the center: the deck minus the cards dealt to players. */
export function onuwCenterCards(deck: OnuwDeck, dealt: readonly OnuwRole[]): Counts {
  const held = countRoles(dealt);
  return Object.fromEntries(ONUW_ROLES.map((role) => [role, Math.max(0, (deck[role] ?? 0) - (held[role] ?? 0))]).filter(([, count]) => (count as number) > 0));
}

/**
 * Cards that can be in players' hands after the night. Robber and Troublemaker only swap cards between
 * players, so without a Drunk the hands hold exactly the dealt cards. A dealt Drunk swaps the card in
 * front of them with one center card, so one center card may come in (and one dealt card goes out).
 */
export function onuwFinalCardPool(deck: OnuwDeck, dealt: readonly OnuwRole[]): Counts {
  const pool = countRoles(dealt);
  if (!dealt.includes("DRUNK")) return pool;
  for (const [role, count] of Object.entries(onuwCenterCards(deck, dealt)) as Array<[OnuwRole, number]>) pool[role] = (pool[role] ?? 0) + count;
  return pool;
}

/** Roles one player can still pick, given the cards the other players have already confirmed. */
export function onuwFinalCardOptions(deck: OnuwDeck, dealt: readonly OnuwRole[], finals: readonly (OnuwRole | null)[], player: number): OnuwRole[] {
  const pool = onuwFinalCardPool(deck, dealt);
  const taken = countRoles(finals.filter((role, index): role is OnuwRole => index !== player && role !== null));
  return ONUW_ROLES.filter((role) => (pool[role] ?? 0) > (taken[role] ?? 0) || finals[player] === role);
}

/**
 * True when the confirmed hands are possible: the dealt cards, or (with a dealt Drunk) the dealt cards
 * with exactly one card exchanged for a center card.
 */
export function validOnuwFinalCards(deck: OnuwDeck, dealt: readonly OnuwRole[], finals: readonly OnuwRole[]) {
  if (finals.length !== dealt.length) return false;
  const before = countRoles(dealt);
  const after = countRoles(finals);
  let added = 0;
  let removed = 0;
  const center = onuwCenterCards(deck, dealt);
  for (const role of ONUW_ROLES) {
    const diff = (after[role] ?? 0) - (before[role] ?? 0);
    if (diff > 0) {
      if (diff > (center[role] ?? 0)) return false;
      added += diff;
    } else removed -= diff;
  }
  if (added === 0) return true;
  return dealt.includes("DRUNK") && added === 1 && removed === 1;
}
