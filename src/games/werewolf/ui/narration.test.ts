import { describe, expect, it } from "vitest";
import type { ClassicAction, ClassicGameState, ClassicRole } from "@/games/werewolf/contract";
import { advanceClassic, applyClassicAction, createClassicGame } from "@/games/werewolf/engine/classic/engine";
import { buildPublicView } from "@/games/werewolf/server/view";
import { narrationKey, narrationLines, type NarrationKey } from "@/games/werewolf/ui/narration";
import type { VoiceLine } from "@/games/werewolf/voice/templates";

const NOW = Date.UTC(2026, 10, 23, 20);
const NAMES = ["Alya", "Budi", "Citra", "Dimas", "Eka", "Fajar"];

function game(roleList: ClassicRole[]): ClassicGameState {
  const players = roleList.map((_, index) => ({ id: `p${index + 1}`, name: NAMES[index]! }));
  const roles: Partial<Record<ClassicRole, number>> = {};
  for (const role of roleList) roles[role] = (roles[role] ?? 0) + 1;
  const state = createClassicGame(players, { roles, deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180 }, { now: NOW, random: () => 0 });
  const assigned = Object.fromEntries(players.map((player, index) => [player.id, roleList[index]!])) as Record<string, ClassicRole>;
  return { ...state, secret: { ...state.secret, roles: { ...assigned }, originalRoles: { ...assigned } } };
}

const expire = (state: ClassicGameState) => advanceClassic(state, Date.parse(state.public.phaseDeadlineAt!))!;
const act = (state: ClassicGameState, id: string, action: ClassicAction) =>
  applyClassicAction(state, { playerId: id, isHost: id === "p1" }, action, { now: state.public.phaseDeadlineAt ? Date.parse(state.public.phaseDeadlineAt) - 1000 : NOW });
const readyAll = (state: ClassicGameState) => state.public.players.reduce((current, player) => act(current, player.id, { type: "ready" }), state);

/** Collects what the narrator would say for each successive state. */
function narrate(states: ClassicGameState[]) {
  let prev: NarrationKey | null = null;
  return states.map((state) => {
    const view = buildPublicView(state);
    const lines = narrationLines(prev, view);
    prev = narrationKey(view);
    return lines;
  });
}

/** Static clips as their file name; named (server TTS) lines as "TTS: text". */
const describeLines = (lines: VoiceLine[]) => lines.map((line) => line.clip ? line.clip.split("/").at(-1)! : `TTS: ${line.text}`);

describe("narration", () => {
  it("calls roles at night, names the victim at dawn, and names the executed player", () => {
    const intro = readyAll(game(["WEREWOLF", "SEER", "DOCTOR", "VILLAGER", "VILLAGER"]));
    const wolfTurn = expire(intro);
    const picked = act(wolfTurn, "p1", { type: "wolf-target", targetId: "p4" });
    const doctorTurn = expire(picked);
    const seerTurn = expire(doctorTurn);
    const day = expire(seerTurn);
    const voting = expire(day);
    const afterVote = ["p1", "p2", "p3", "p5"].reduce((current, id) => act(current, id, { type: "vote", targetId: id === "p1" ? "p2" : "p1" }), voting);
    const said = narrate([intro, wolfTurn, picked, doctorTurn, seerTurn, day, voting, afterVote]).map(describeLines);
    expect(said[0]).toEqual(["night_intro.mp3"]);
    expect(said[1]).toEqual(["turn_werewolf.mp3"]);
    expect(said[2]).toEqual([]);
    expect(said[3]).toEqual(["turn_end.mp3", "turn_doctor.mp3"]);
    expect(said[4]).toEqual(["turn_end.mp3", "turn_seer.mp3"]);
    expect(said[5]).toEqual(["TTS: Pagi telah tiba! Warga desa terbangun dengan kabar duka... Dimas ditemukan tewas semalam.", "day_discussion_start.mp3"]);
    expect(said[6]).toEqual(["voting_start.mp3"]);
    expect(said[7]).toEqual(["TTS: Warga desa telah memutuskan... Alya dieksekusi hari ini!", "win_villager.mp3"]);
    // Night lines are static role-only clips and never carry a player's name.
    for (const line of [...said[0]!, ...said[1]!, ...said[3]!]) for (const name of NAMES) expect(line).not.toContain(name);
  });

  it("falls back to the generic static clip when a named line cannot be synthesized", () => {
    const intro = readyAll(game(["WEREWOLF", "SEER", "DOCTOR", "VILLAGER", "VILLAGER"]));
    const day = expire(expire(expire(act(expire(intro), "p1", { type: "wolf-target", targetId: "p4" }))));
    expect(day.public.phase).toBe("DAY_DISCUSSION");
    const [dawn] = narrationLines(narrationKey(buildPublicView(expire(intro))), buildPublicView(day));
    expect(dawn?.fallbackClip).toBe("/audio/werewolf/classic/dawn_single_kill.mp3");
  });

  it("announces the dawn before an overnight Hunter's shot", () => {
    const intro = readyAll(game(["WEREWOLF", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]));
    const wolfTurn = expire(intro);
    const picked = act(wolfTurn, "p1", { type: "wolf-target", targetId: "p2" });
    const hunter = expire(picked);
    expect(hunter.public.phase).toBe("HUNTER_REVENGE");
    const said = narrate([intro, wolfTurn, picked, hunter]).map(describeLines);
    expect(said[3]).toEqual([
      "TTS: Pagi telah tiba! Warga desa terbangun dengan kabar duka... Budi ditemukan tewas semalam.",
      "TTS: Sang Pemburu, Budi, gugur, namun ia sempat menarik pelatuk senjatanya! Budi... pilih satu targetmu di layar sekarang!",
    ]);
  });
});
