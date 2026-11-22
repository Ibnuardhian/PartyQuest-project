import type { ClassicPhase, NightRole } from "@/games/werewolf/contract";
import { classicVoice, type VoiceLine } from "@/games/werewolf/voice/templates";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

/**
 * Decides what the narrator says when the public state moves from `prev` to `next`.
 * Pure, so it is unit-tested; the hook only plays the returned lines.
 * Daytime announcements name players; night turns name roles only.
 */
type PublicView = WerewolfView["public"];

export interface NarrationKey { phase: ClassicPhase; night: number; day: number; role: NightRole | null }

export function narrationKey(view: PublicView): NarrationKey {
  return { phase: view.phase, night: view.nightNumber, day: view.dayNumber, role: view.activeNightRole };
}

function sameKey(a: NarrationKey, b: NarrationKey) {
  return a.phase === b.phase && a.night === b.night && a.day === b.day && a.role === b.role;
}

export function narrationLines(prev: NarrationKey | null, next: PublicView): VoiceLine[] {
  const key = narrationKey(next);
  if (prev && sameKey(prev, key)) return [];
  const lines: VoiceLine[] = [];
  const nameOf = (id: string | null) => next.players.find((player) => player.id === id)?.name ?? "";
  const lastLog = next.log.at(-1);
  const fromNight = prev?.phase === "NIGHT_TURN" || prev?.phase === "NIGHT_INTRO";
  const dawnLine = () => {
    const dawn = [...next.log].reverse().find((entry) => entry.type === "DAWN");
    const victims = dawn && dawn.type === "DAWN" ? dawn.deadPlayerIds.map(nameOf).filter(Boolean) : [];
    return victims.length === 0 ? classicVoice.dawnNoKill() : classicVoice.dawnKills(victims);
  };

  // A vote just resolved (left OPEN_VOTING / TIE_REVOTE without another tie).
  if (prev && (prev.phase === "OPEN_VOTING" || prev.phase === "TIE_REVOTE") && key.phase !== "TIE_DEFENSE" && lastLog?.type === "EXECUTION") {
    lines.push(lastLog.playerId ? classicVoice.execution(nameOf(lastLog.playerId)) : classicVoice.noExecution());
  }
  switch (key.phase) {
    case "NIGHT_INTRO":
      lines.push(classicVoice.nightIntro());
      break;
    case "NIGHT_TURN":
      if (prev?.phase === "NIGHT_TURN" && prev.role) lines.push(classicVoice.turnEnd());
      if (key.role) lines.push(classicVoice.turnStart(key.role));
      break;
    case "HUNTER_REVENGE":
      // A Hunter killed overnight: announce the dawn first, then the shot.
      if (fromNight) lines.push(dawnLine());
      if (next.hunterId) lines.push(classicVoice.hunter(nameOf(next.hunterId)));
      break;
    case "DAY_DISCUSSION":
      if (fromNight) lines.push(dawnLine());
      lines.push(classicVoice.dayStart());
      break;
    case "OPEN_VOTING":
      lines.push(classicVoice.votingStart());
      break;
    case "TIE_DEFENSE":
      lines.push(classicVoice.voteTie());
      break;
    case "GAME_OVER":
      if (next.winner) lines.push(classicVoice.win(next.winner.faction));
      break;
    default:
      break;
  }
  return lines;
}
