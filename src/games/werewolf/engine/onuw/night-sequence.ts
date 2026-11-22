import type { OnuwRole } from "@/games/werewolf/contract";
import type { OnuwDeck } from "@/games/werewolf/engine/onuw/deck";

/** Strict ONUW wake-up order with the pause per role (docs/02 §3.2). */
export const ONUW_NIGHT_ORDER: ReadonlyArray<{ role: OnuwRole; seconds: number }> = [
  { role: "WEREWOLF", seconds: 12 },
  { role: "MINION", seconds: 10 },
  { role: "MASON", seconds: 10 },
  { role: "SEER", seconds: 14 },
  { role: "ROBBER", seconds: 14 },
  { role: "TROUBLEMAKER", seconds: 14 },
  { role: "DRUNK", seconds: 12 },
  { role: "INSOMNIAC", seconds: 10 },
];

export const ONUW_START_SECONDS = 5;

export type OnuwNightStep = { key: "ONUW_START"; seconds: number } | { key: OnuwRole; seconds: number } | { key: "ONUW_DAY"; seconds: 0 };

/**
 * Night script for the voice-only phone. Every role in the N + 3 deck is called, including
 * cards that may be in the center, so the narration never reveals which cards were dealt.
 */
export function buildOnuwNightSequence(deck: OnuwDeck): OnuwNightStep[] {
  return [
    { key: "ONUW_START", seconds: ONUW_START_SECONDS },
    ...ONUW_NIGHT_ORDER.filter((step) => (deck[step.role] ?? 0) > 0).map((step) => ({ key: step.role, seconds: step.seconds })),
    { key: "ONUW_DAY", seconds: 0 },
  ];
}
