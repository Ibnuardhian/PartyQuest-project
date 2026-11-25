import type { NightRole } from "@/games/werewolf/contract";
import pack from "@/games/werewolf/voice/voice-pack.json";
import { classicVoice, type VoiceLine } from "@/games/werewolf/voice/templates";

/**
 * How long the narrator talks at each phase change, so the clock only starts once the voice has finished
 * (the same order as ONUW: narrator first, then the countdown). Static clips use the length measured into
 * the voice pack by `npm run voice:measure`; named lines are synthesized on demand, so they are estimated
 * from their text. The server adds this to the phase deadline whether or not an audio device is listening,
 * which keeps every phone on the same clock.
 */

/** The shortest time a player gets to act after the narrator finished, whatever the host configured. */
export const MIN_ACTION_SECONDS = 10;
/** Extra time given once to a role holder who has not acted when the countdown runs out. */
export const OVERTIME_SECONDS = 10;

const CLIP_SECONDS = new Map(pack.items.map((item) => [item.file, "seconds" in item && typeof item.seconds === "number" ? item.seconds : 0]));
const SPOKEN_CHARS_PER_SECOND = 10;

/** Estimated length of one line: the measured clip when there is one, otherwise from the text length. */
export function lineSeconds(line: VoiceLine) {
  const measured = line.clip ? CLIP_SECONDS.get(line.clip) ?? 0 : 0;
  return measured > 0 ? measured : line.text.length / SPOKEN_CHARS_PER_SECOND + 1;
}

/** Whole seconds to wait for a run of lines, with a small margin for loading and the pauses between lines. */
export function speechSeconds(lines: readonly VoiceLine[]) {
  return Math.ceil(lines.reduce((sum, line) => sum + lineSeconds(line) + 0.4, 0)) + 1;
}

/** The night opens (after a vote's execution line, when there was one). */
export function nightIntroSpeech(executedName: string | null) {
  return speechSeconds([...(executedName ? [classicVoice.execution(executedName)] : []), classicVoice.nightIntro()]);
}

/** A night turn: the previous turn's "time is up" line (not on the first turn), then this role's call. */
export function turnSpeech(role: NightRole, first: boolean) {
  return speechSeconds([...(first ? [] : [classicVoice.turnEnd()]), classicVoice.turnStart(role)]);
}

/** Daybreak: the victims (when a night just ended), then the discussion opening. */
export function daySpeech(victimNames: readonly string[] | null) {
  const dawn = victimNames === null ? [] : [victimNames.length === 0 ? classicVoice.dawnNoKill() : classicVoice.dawnKills([...victimNames])];
  return speechSeconds([...dawn, classicVoice.dayStart()]);
}

/** The Hunter's call, after the dawn announcement when the Hunter fell overnight. */
export function hunterSpeech(hunterName: string, victimNames: readonly string[] | null) {
  const dawn = victimNames === null ? [] : [victimNames.length === 0 ? classicVoice.dawnNoKill() : classicVoice.dawnKills([...victimNames])];
  return speechSeconds([...dawn, classicVoice.hunter(hunterName)]);
}

export function votingSpeech() {
  return speechSeconds([classicVoice.votingStart()]);
}

export function tieSpeech() {
  return speechSeconds([classicVoice.voteTie()]);
}
