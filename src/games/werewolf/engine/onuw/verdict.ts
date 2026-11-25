import type { OnuwRole } from "@/games/werewolf/contract";
import type { OnuwDeck } from "@/games/werewolf/engine/onuw/deck";
import { onuwCenterCards } from "@/games/werewolf/engine/onuw/final-cards";

/**
 * ONUW result from the cards of the players who died only (docs/01 §4). The physical cards stay face down
 * except for the dead players', so the app asks for those, plus (only when it cannot work it out) whether a
 * Werewolf or a Minion is among the living players' cards. It names the winning team, not the winning players.
 */
export interface OnuwFacts { werewolfInPlay: boolean; minionInPlay: boolean }

export interface OnuwVerdict {
  villageWins: boolean;
  werewolfWins: boolean;
  tannerWins: boolean;
  reason: string;
}

/**
 * - With a Werewolf among players: the village wins if a Werewolf dies; the Werewolf team (Werewolves and
 *   Minion) wins if no Werewolf and no Tanner dies.
 * - With no Werewolf among players: the village wins if nobody dies or only Minions die; a Minion wins if
 *   anyone other than a Minion dies.
 * - A Tanner wins by dying, and that alone denies the Werewolf team the win.
 * A dead Werewolf or Minion is of course among the players, whatever `facts` says.
 */
export function onuwVerdict(deadCards: readonly OnuwRole[], facts: OnuwFacts): OnuwVerdict {
  const died = (role: OnuwRole) => deadCards.includes(role);
  const werewolfInPlay = facts.werewolfInPlay || died("WEREWOLF");
  const minionInPlay = facts.minionInPlay || died("MINION");
  const tannerWins = died("TANNER");
  if (werewolfInPlay) {
    const villageWins = died("WEREWOLF");
    const werewolfWins = !villageWins && !tannerWins;
    const reason = villageWins ? "Werewolf tertangkap." : tannerWins ? "Tanner mati; Werewolf tidak tertangkap tetapi tidak ikut menang." : "Tidak ada Werewolf yang mati.";
    return { villageWins, werewolfWins, tannerWins, reason };
  }
  const othersDied = deadCards.some((role) => role !== "MINION");
  const villageWins = !othersDied;
  const werewolfWins = minionInPlay && othersDied;
  const reason = deadCards.length === 0 ? "Tidak ada Werewolf di antara pemain dan tidak ada yang mati."
    : villageWins ? "Tidak ada Werewolf di antara pemain; hanya Minion yang mati."
    : werewolfWins ? "Tidak ada Werewolf di antara pemain; Minion menang karena pemain lain mati."
    : "Tidak ada Werewolf di antara pemain, tetapi ada warga yang mati.";
  return { villageWins, werewolfWins, tannerWins, reason };
}

type Watched = "WEREWOLF" | "MINION";
export type OnuwKnown = Record<Watched, boolean | null>;
export type OnuwAnswers = Partial<Record<Watched, boolean>>;

/**
 * Whether a Werewolf / Minion is among the players' final cards, when that follows from what is known: true
 * (a dead card, or a copy that cannot have left), false (no such card anywhere), or null (must be asked).
 * Without a Drunk the hands are exactly the dealt cards. A dealt Drunk swaps one card for a center card, so
 * a single dealt copy might have moved out or one might have come in.
 */
export function onuwKnownCards(deck: OnuwDeck, dealt: readonly OnuwRole[], deadCards: readonly OnuwRole[]): OnuwKnown {
  const hasDrunk = dealt.includes("DRUNK");
  const center = onuwCenterCards(deck, dealt);
  const known = (role: Watched): boolean | null => {
    if (deadCards.includes(role)) return true;
    const held = dealt.filter((card) => card === role).length;
    if (!hasDrunk) return held > 0;
    if (held >= 2) return true;
    return held + (center[role] ?? 0) === 0 ? false : null;
  };
  return { WEREWOLF: known("WEREWOLF"), MINION: known("MINION") };
}

/** The next yes/no question to ask, or null when the verdict can be computed. The Minion only matters with no Werewolf. */
export function nextOnuwQuestion(known: OnuwKnown, answers: OnuwAnswers): Watched | null {
  const werewolf = known.WEREWOLF ?? answers.WEREWOLF;
  if (werewolf === undefined) return "WEREWOLF";
  if (werewolf) return null;
  return (known.MINION ?? answers.MINION) === undefined ? "MINION" : null;
}

export function resolveOnuwFacts(known: OnuwKnown, answers: OnuwAnswers): OnuwFacts {
  return { werewolfInPlay: known.WEREWOLF ?? answers.WEREWOLF ?? false, minionInPlay: known.MINION ?? answers.MINION ?? false };
}
