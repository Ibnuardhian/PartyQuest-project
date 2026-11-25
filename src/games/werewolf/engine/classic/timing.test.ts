import { describe, expect, it } from "vitest";
import type { ClassicAction, ClassicGameState, ClassicRole, NightRole } from "@/games/werewolf/contract";
import { activeNightRole, advanceClassic, applyClassicAction, createClassicGame } from "@/games/werewolf/engine/classic/engine";
import { daySpeech, lineSeconds, MIN_ACTION_SECONDS, nightIntroSpeech, OVERTIME_SECONDS, turnSpeech } from "@/games/werewolf/engine/classic/timing";
import { VOICE_PACK, classicVoice } from "@/games/werewolf/voice/templates";

/** The narrator speaks first and the players' countdown starts after it (like ONUW), with overtime for a late holder. */
const NOW = Date.UTC(2026, 10, 25, 20);

function game(roleList: ClassicRole[], nightTurnSeconds = 15): ClassicGameState {
  const players = roleList.map((_, index) => ({ id: `p${index + 1}`, name: `Pemain ${index + 1}` }));
  const roles: Partial<Record<ClassicRole, number>> = {};
  for (const role of roleList) roles[role] = (roles[role] ?? 0) + 1;
  const state = createClassicGame(players, { roles, deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds, dayDiscussionSeconds: 180, advanced: true }, { now: NOW, random: () => 0 });
  const assigned = Object.fromEntries(players.map((player, index) => [player.id, roleList[index]!])) as Record<string, ClassicRole>;
  return { ...state, secret: { ...state.secret, roles: { ...assigned }, originalRoles: { ...assigned } } };
}

const at = (iso: string | null) => Date.parse(iso!);
const act = (state: ClassicGameState, playerId: string, action: ClassicAction, now = NOW) => applyClassicAction(state, { playerId, isHost: playerId === "p1" }, action, { now });
const readyAll = (state: ClassicGameState) => state.public.players.reduce((current, player) => act(current, player.id, { type: "ready" }), state);
const LIST: ClassicRole[] = ["WEREWOLF", "SEER", "DOCTOR", "VILLAGER", "VILLAGER"];

function toTurn(state: ClassicGameState, role: NightRole) {
  let current = state;
  for (let guard = 0; guard < 12 && activeNightRole(current) !== role; guard += 1) {
    const next = advanceClassic(current, at(current.public.phaseDeadlineAt));
    if (!next) throw new Error("did not advance");
    current = next;
  }
  expect(activeNightRole(current)).toBe(role);
  return current;
}

describe("narrator first, then the clock", () => {
  it("every voice-pack line has a measured length", () => {
    for (const item of VOICE_PACK.items) expect("seconds" in item && item.seconds > 0, item.key).toBe(true);
  });

  it("gives the night intro the time its clip needs (it used to be cut at 6 s)", () => {
    const state = readyAll(game(LIST));
    const seconds = (at(state.public.phaseDeadlineAt) - NOW) / 1000;
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(seconds).toBeGreaterThanOrEqual(lineSeconds(classicVoice.nightIntro()));
    expect(seconds).toBe(Math.max(6, nightIntroSpeech(null)));
  });

  it("starts each night turn's countdown only after the call, and never below 10 seconds", () => {
    const intro = readyAll(game(LIST, 10));
    const turn = advanceClassic(intro, at(intro.public.phaseDeadlineAt))!;
    const start = at(intro.public.phaseDeadlineAt);
    expect(turn.public.phase).toBe("NIGHT_TURN");
    expect(at(turn.public.actionStartsAt) - start).toBe(turnSpeech(turn.public.nightQueue[0]!, true) * 1000);
    expect(at(turn.public.phaseDeadlineAt) - at(turn.public.actionStartsAt)).toBe(MIN_ACTION_SECONDS * 1000);
    const slower = readyAll(game(LIST, 30));
    const slowTurn = advanceClassic(slower, at(slower.public.phaseDeadlineAt))!;
    expect(at(slowTurn.public.phaseDeadlineAt) - at(slowTurn.public.actionStartsAt)).toBe(30_000);
  });

  it("the Guardian Angel keeps the full window after being called, so the call is not skipped through", () => {
    const doctor = toTurn(readyAll(game(LIST)), "DOCTOR");
    const callMs = turnSpeech("DOCTOR", false) * 1000;
    expect(at(doctor.public.actionStartsAt) - (at(doctor.public.phaseDeadlineAt) - callMs - 15_000)).toBe(callMs);
    expect(lineSeconds(classicVoice.turnStart("DOCTOR")) * 1000).toBeLessThan(callMs);
  });
});

describe("overtime", () => {
  it("extends a turn once when the holder has not acted, then moves on", () => {
    const doctor = toTurn(readyAll(game(LIST)), "DOCTOR");
    const deadline = at(doctor.public.phaseDeadlineAt);
    const extended = advanceClassic(doctor, deadline)!;
    expect(extended.public.phase).toBe("NIGHT_TURN");
    expect(activeNightRole(extended)).toBe("DOCTOR");
    expect(extended.public.overtime).toBe(true);
    expect(at(extended.public.phaseDeadlineAt)).toBe(deadline + OVERTIME_SECONDS * 1000);
    const next = advanceClassic(extended, at(extended.public.phaseDeadlineAt))!;
    expect(activeNightRole(next)).not.toBe("DOCTOR");
    expect(next.public.overtime).toBe(false);
  });

  it("does not extend when the holder acted, or when nobody alive holds the role", () => {
    const doctor = toTurn(readyAll(game(LIST)), "DOCTOR");
    const acted = act(doctor, "p3", { type: "night-action", actionType: "DOCTOR_PROTECT", targetId: "p4" }, at(doctor.public.actionStartsAt) + 1000);
    expect(advanceClassic(acted, at(acted.public.phaseDeadlineAt))!.public.overtime).toBe(false);
    const dead = { ...doctor, public: { ...doctor.public, players: doctor.public.players.map((player) => player.id === "p3" ? { ...player, alive: false } : player) } };
    expect(advanceClassic(dead, at(dead.public.phaseDeadlineAt))!.public.overtime).toBe(false);
  });

  it("does not strike a holder when the host skips while the narrator is still calling", () => {
    const doctor = toTurn(readyAll(game(LIST)), "DOCTOR");
    const early = act(doctor, "p1", { type: "force-advance" }, at(doctor.public.actionStartsAt) - 1000);
    expect(early.public.players.find((player) => player.id === "p3")?.hasAfkPenalty).toBe(false);
    const late = act(doctor, "p1", { type: "force-advance" }, at(doctor.public.actionStartsAt) + 1000);
    expect(late.public.players.find((player) => player.id === "p3")?.hasAfkPenalty).toBe(true);
  });
});

describe("the day", () => {
  it("counts the discussion only after the dawn announcement and the opening line", () => {
    expect(daySpeech(["Pemain 4"])).toBeGreaterThan(daySpeech(null));
    expect(daySpeech(null)).toBeGreaterThanOrEqual(Math.ceil(lineSeconds(classicVoice.dayStart())));
  });
});
