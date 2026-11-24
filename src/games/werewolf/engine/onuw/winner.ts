import type { OnuwRole } from "@/games/werewolf/contract";

export type OnuwTeam = "village" | "werewolf" | "tanner";

/** Team of a final (end-of-night) card. */
export function onuwTeam(role: OnuwRole): OnuwTeam {
  if (role === "WEREWOLF" || role === "MINION") return "werewolf";
  if (role === "TANNER") return "tanner";
  return "village";
}

/**
 * Hunters that died and have not shot yet. A Hunter who dies takes the player they point at with
 * them; that player may be another Hunter, so the caller asks again until this list is empty.
 */
export function pendingHunters(finalRoles: readonly OnuwRole[], dead: readonly number[], resolved: readonly number[]) {
  return dead.filter((index) => finalRoles[index] === "HUNTER" && !resolved.includes(index));
}

export interface OnuwOutcome {
  villageWins: boolean;
  werewolfWins: boolean;
  tannerWins: boolean;
  /** Indexes of every winning player (dead winners still win). */
  winners: number[];
  reason: string;
}

/**
 * Win check for One Night Ultimate Werewolf, from the cards players hold at the end of the night
 * (docs/01 §4). `dead` holds the players with the most pointing fingers plus Hunter victims; an
 * empty list means nobody died (for example when every player got exactly one vote).
 *
 * - With a Werewolf among players: the village wins if at least one Werewolf dies; the Werewolf team
 *   (Werewolves and Minion) wins if no Werewolf dies and no Tanner dies.
 * - With no Werewolf among players: the village wins if nobody dies, or if only Minions die; a Minion
 *   wins if anyone other than a Minion dies.
 * - A Tanner wins by dying. Their death alone denies the Werewolf team the win.
 */
export function onuwOutcome(finalRoles: readonly OnuwRole[], dead: readonly number[]): OnuwOutcome {
  const deadSet = new Set(dead);
  const isDead = (role: OnuwRole) => finalRoles.some((value, index) => value === role && deadSet.has(index));
  const werewolfInPlay = finalRoles.includes("WEREWOLF");
  const tannerWins = isDead("TANNER");
  let villageWins: boolean;
  let werewolfWins: boolean;
  let reason: string;
  if (werewolfInPlay) {
    villageWins = isDead("WEREWOLF");
    werewolfWins = !villageWins && !tannerWins;
    reason = villageWins ? "Werewolf tertangkap." : tannerWins ? "Tanner mati; Werewolf tidak tertangkap tetapi tidak ikut menang." : "Tidak ada Werewolf yang mati.";
  } else {
    const othersDied = dead.some((index) => finalRoles[index] !== "MINION");
    villageWins = !othersDied;
    werewolfWins = finalRoles.includes("MINION") && othersDied;
    reason = dead.length === 0 ? "Tidak ada Werewolf di antara pemain dan tidak ada yang mati." : villageWins ? "Tidak ada Werewolf di antara pemain; hanya Minion yang mati." : werewolfWins ? "Tidak ada Werewolf di antara pemain; Minion menang karena pemain lain mati." : "Tidak ada Werewolf di antara pemain, tetapi ada warga yang mati.";
  }
  const winners = finalRoles.flatMap((role, index) => {
    const team = onuwTeam(role);
    const wins = team === "village" ? villageWins : team === "werewolf" ? werewolfWins : deadSet.has(index);
    return wins ? [index] : [];
  });
  return { villageWins, werewolfWins, tannerWins, winners, reason };
}
