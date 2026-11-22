import type { ClassicPhase, NightRole } from "@/games/werewolf/contract";
import { CLASSIC_LINES, countWords, joinNames, nightOrdinal, renderLine } from "@/games/werewolf/voice/templates";
import { FACTION_LABELS, roleName, type WerewolfView } from "@/games/werewolf/ui/labels";

/**
 * Decides what the narrator says when the public state moves from `prev` to `next`.
 * Pure, so it is unit-tested; the hook only speaks the returned lines.
 * Announcements name players (as in the original spec); night turns name only roles.
 */
type PublicView = WerewolfView["public"];

export interface NarrationKey { phase: ClassicPhase; night: number; day: number; role: NightRole | null }

export function narrationKey(view: PublicView): NarrationKey {
  return { phase: view.phase, night: view.nightNumber, day: view.dayNumber, role: view.activeNightRole };
}

function sameKey(a: NarrationKey, b: NarrationKey) {
  return a.phase === b.phase && a.night === b.night && a.day === b.day && a.role === b.role;
}

export function narrationLines(prev: NarrationKey | null, next: PublicView): string[] {
  const key = narrationKey(next);
  if (prev && sameKey(prev, key)) return [];
  const lines: string[] = [];
  const nameOf = (id: string | null) => next.players.find((player) => player.id === id)?.name ?? "";
  const lastLog = next.log.at(-1);
  const fromNight = prev?.phase === "NIGHT_TURN" || prev?.phase === "NIGHT_INTRO";
  const dawnLine = () => {
    const dawn = [...next.log].reverse().find((entry) => entry.type === "DAWN");
    const victims = dawn && dawn.type === "DAWN" ? dawn.deadPlayerIds.map(nameOf) : [];
    return victims.length === 0 ? CLASSIC_LINES.DAWN_NO_KILL
      : victims.length === 1 ? renderLine(CLASSIC_LINES.DAWN_SINGLE_KILL, { victimName: victims[0]! })
        : renderLine(CLASSIC_LINES.DAWN_MULTI_KILL, { victimList: joinNames(victims) });
  };
  // A vote just resolved (left OPEN_VOTING / TIE_REVOTE without another tie).
  if (prev && (prev.phase === "OPEN_VOTING" || prev.phase === "TIE_REVOTE") && key.phase !== "TIE_DEFENSE" && lastLog?.type === "EXECUTION") {
    lines.push(lastLog.playerId ? renderLine(CLASSIC_LINES.EXECUTION_RESULT, { executedName: nameOf(lastLog.playerId) }) : CLASSIC_LINES.NO_EXECUTION);
  }
  switch (key.phase) {
    case "NIGHT_INTRO":
      lines.push(renderLine(CLASSIC_LINES.NIGHT_INTRO, { nightOrdinal: nightOrdinal(key.night) }));
      break;
    case "NIGHT_TURN":
      if (prev?.phase === "NIGHT_TURN" && prev.role) lines.push(renderLine(CLASSIC_LINES.NIGHT_TURN_END, { roleName: roleName(prev.role) }));
      if (key.role) lines.push(renderLine(CLASSIC_LINES.NIGHT_TURN_START, { roleName: roleName(key.role) }));
      break;
    case "HUNTER_REVENGE":
      // A Hunter killed overnight: announce the dawn first, then the shot.
      if (fromNight) lines.push(dawnLine());
      if (next.hunterId) lines.push(renderLine(CLASSIC_LINES.HUNTER_TRIGGER, { hunterName: nameOf(next.hunterId) }));
      break;
    case "DAY_DISCUSSION": {
      if (fromNight) lines.push(dawnLine());
      lines.push(renderLine(CLASSIC_LINES.DAY_START, { minutes: countWords(Math.max(1, Math.round(next.dayDiscussionSeconds / 60))) }));
      break;
    }
    case "OPEN_VOTING":
      lines.push(CLASSIC_LINES.VOTING_START);
      break;
    case "TIE_DEFENSE":
      lines.push(CLASSIC_LINES.VOTE_TIE);
      break;
    case "GAME_OVER":
      if (next.winner) lines.push(renderLine(CLASSIC_LINES.GAME_OVER, { winningFaction: FACTION_LABELS[next.winner.faction] }));
      break;
    default:
      break;
  }
  return lines;
}
