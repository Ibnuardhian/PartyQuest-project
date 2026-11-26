import { describe, expect, it } from "vitest";
import type { ClassicAction, ClassicGameState, ClassicRole, ClassicSettings, NightRole } from "@/games/werewolf/contract";
import { activeNightRole, advanceClassic, applyClassicAction, ClassicRuleError, createClassicGame } from "@/games/werewolf/engine/classic/engine";
import { defaultClassicSettings, validateClassicSettings } from "@/games/werewolf/engine/classic/settings";
import { recommendedComposition } from "@/games/werewolf/roles";

const NOW = Date.UTC(2026, 10, 22, 20);

/** Builds a game where player pN holds roleList[N-1]. p1 is the host. */
function game(roleList: ClassicRole[], overrides: Partial<ClassicSettings> = {}): ClassicGameState {
  const players = roleList.map((_, index) => ({ id: `p${index + 1}`, name: `Pemain ${index + 1}` }));
  const roles: Partial<Record<ClassicRole, number>> = {};
  for (const role of roleList) roles[role] = (roles[role] ?? 0) + 1;
  const state = createClassicGame(players, { roles, deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180, advanced: true, ...overrides }, { now: NOW, random: () => 0 });
  const assigned = Object.fromEntries(players.map((player, index) => [player.id, roleList[index]!])) as Record<string, ClassicRole>;
  return { ...state, secret: { ...state.secret, roles: { ...assigned }, originalRoles: { ...assigned } } };
}

const deadlineOf = (state: ClassicGameState) => Date.parse(state.public.phaseDeadlineAt!);

function act(state: ClassicGameState, playerId: string, action: ClassicAction, extra: { onlinePlayerIds?: string[]; random?: () => number } = {}) {
  return applyClassicAction(state, { playerId, isHost: playerId === "p1" }, action, { now: state.public.phaseDeadlineAt ? deadlineOf(state) - 1000 : NOW, ...extra });
}

function expire(state: ClassicGameState) {
  const next = advanceClassic(state, deadlineOf(state));
  if (!next) throw new Error(`phase ${state.public.phase} did not advance`);
  return next;
}

function readyAll(state: ClassicGameState) {
  return state.public.players.reduce((current, player) => act(current, player.id, { type: "ready" }), state);
}

function toTurn(state: ClassicGameState, role: NightRole) {
  let current = state;
  for (let guard = 0; guard < 10 && activeNightRole(current) !== role; guard += 1) current = expire(current);
  expect(activeNightRole(current)).toBe(role);
  return current;
}

function finishNight(state: ClassicGameState) {
  let current = state;
  for (let guard = 0; guard < 10 && (current.public.phase === "NIGHT_INTRO" || current.public.phase === "NIGHT_TURN"); guard += 1) current = expire(current);
  return current;
}

function voteAll(state: ClassicGameState, votes: Record<string, string | null>) {
  return Object.entries(votes).reduce((current, [voter, target]) => act(current, voter, { type: "vote", targetId: target }), state);
}

const alive = (state: ClassicGameState, id: string) => state.public.players.find((player) => player.id === id)!.alive;
const BASIC: ClassicRole[] = ["WEREWOLF", "SEER", "DOCTOR", "VILLAGER", "VILLAGER"];

describe("settings and composition", () => {
  it("recommends a valid composition for 5–16 players", () => {
    for (let count = 5; count <= 16; count += 1) {
      const settings = defaultClassicSettings(count);
      expect(Object.values(settings.roles).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(count);
      expect(() => validateClassicSettings(settings, count)).not.toThrow();
    }
    expect(recommendedComposition(5)).toEqual({ SEER: 1, DOCTOR: 1, WEREWOLF: 1, VILLAGER: 2 });
    expect(recommendedComposition(9)).toMatchObject({ MASON: 2, WEREWOLF: 2, VILLAGER: 2 });
  });

  it("rejects bad compositions", () => {
    const base = defaultClassicSettings(5);
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, VILLAGER: 3 } }, 5)).toThrow("sama dengan jumlah pemain");
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, MASON: 1, VILLAGER: 3 } }, 5)).toThrow("Mason minimal 2");
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, SEER: 2, VILLAGER: 2 } }, 5)).toThrow("Seer maksimal 1");
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 3, VILLAGER: 3 } }, 6)).toThrow("lebih sedikit");
    expect(() => validateClassicSettings({ ...base, roles: { VILLAGER: 5 } }, 5)).toThrow("Minimal ada satu Werewolf");
    expect(() => validateClassicSettings(base, 4)).toThrow("5–16");
    expect(() => validateClassicSettings({ ...base, nightTurnSeconds: 5 }, 5)).toThrow();
  });

  it("deals exactly the configured roles and requires distinct names", () => {
    const players = Array.from({ length: 7 }, (_, index) => ({ id: `p${index}`, name: `N${index}` }));
    const state = createClassicGame(players, defaultClassicSettings(7), { now: NOW });
    const dealt = Object.values(state.secret.roles).sort();
    expect(dealt).toEqual(["DOCTOR", "HUNTER", "SEER", "VILLAGER", "VILLAGER", "WEREWOLF", "WEREWOLF"]);
    expect(() => createClassicGame(players.map((player) => ({ ...player, name: "Sama" })), defaultClassicSettings(7), { now: NOW })).toThrow(ClassicRuleError);
  });
});

describe("night flow", () => {
  it("starts the night when everyone is ready, with a fixed night-1 queue", () => {
    const state = readyAll(game(["WEREWOLF", "CUPID", "MASON", "MASON", "VILLAGER"]));
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(state.public.nightNumber).toBe(1);
    expect(state.public.nightQueue).toEqual(["CUPID", "MASON", "WEREWOLF"]);
  });

  it("keeps fixed turn windows even after the role has acted", () => {
    let state = toTurn(readyAll(game(BASIC)), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p4" });
    expect(activeNightRole(state)).toBe("WEREWOLF");
    expect(advanceClassic(state, deadlineOf(state) - 1)).toBeNull();
    expect(activeNightRole(expire(state))).toBe("DOCTOR");
  });

  it("kills the Werewolves' target at dawn and starts the day", () => {
    let state = toTurn(readyAll(game(BASIC)), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p4" });
    state = finishNight(state);
    expect(state.public.phase).toBe("DAY_DISCUSSION");
    expect(state.public.dayNumber).toBe(1);
    expect(alive(state, "p4")).toBe(false);
    expect(state.public.players.find((player) => player.id === "p4")!.deathReason).toBe("WEREWOLF");
    expect(state.public.log.at(-1)).toMatchObject({ type: "DAWN", night: 1, deaths: [{ playerId: "p4", reason: "WEREWOLF" }] });
  });

  it("lets the Doctor save the target but not protect the same player twice in a row", () => {
    let state = toTurn(readyAll(game(BASIC)), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p4" });
    state = toTurn(state, "DOCTOR");
    state = act(state, "p3", { type: "night-action", actionType: "DOCTOR_PROTECT", targetId: "p4" });
    state = finishNight(state);
    expect(alive(state, "p4")).toBe(true);
    state = expire(state); // discussion -> voting
    state = voteAll(state, { p1: null, p2: null, p3: null, p4: null, p5: null });
    state = toTurn(state, "DOCTOR");
    expect(() => act(state, "p3", { type: "night-action", actionType: "DOCTOR_PROTECT", targetId: "p4" })).toThrow("dua malam berturut-turut");
  });

  it("gives the Seer one reading per night: Lycan reads as Werewolf, Minion as Villager", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "SEER", "LYCAN", "MINION", "VILLAGER", "VILLAGER"])), "SEER");
    state = act(state, "p2", { type: "night-action", actionType: "SEER_INSPECT", targetId: "p3" });
    expect(state.secret.seerResults).toEqual([{ seerId: "p2", night: 1, targetId: "p3", appearsAs: "WEREWOLF" }]);
    expect(() => act(state, "p2", { type: "night-action", actionType: "SEER_INSPECT", targetId: "p4" })).toThrow("sudah menerawang");
    let other = toTurn(readyAll(game(["WEREWOLF", "SEER", "LYCAN", "MINION", "VILLAGER", "VILLAGER"])), "SEER");
    other = act(other, "p2", { type: "night-action", actionType: "SEER_INSPECT", targetId: "p4" });
    expect(other.secret.seerResults[0]!.appearsAs).toBe("VILLAGER");
  });

  it("lets the Witch heal tonight's victim and poison someone, once each per game", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "WITCH", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p3" });
    state = toTurn(state, "WITCH");
    state = act(state, "p2", { type: "night-action", actionType: "WITCH_HEAL" });
    state = act(state, "p2", { type: "night-action", actionType: "WITCH_POISON", targetId: "p4" });
    expect(() => act(state, "p2", { type: "night-action", actionType: "WITCH_HEAL" })).toThrow("sudah dipakai");
    state = finishNight(state);
    expect(alive(state, "p3")).toBe(true);
    expect(state.public.players.find((player) => player.id === "p4")!.deathReason).toBe("POISON");
  });

  it("makes a Cursed player a Werewolf instead of killing them", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "CURSED", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p2" });
    state = finishNight(state);
    expect(alive(state, "p2")).toBe(true);
    expect(state.secret.roles.p2).toBe("WEREWOLF");
    expect(state.secret.notices.some((notice) => notice.playerId === "p2")).toBe(true);
  });

  it("blocks the next night's kill after the Werewolves eat the Disease", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "DISEASE", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p2" });
    state = finishNight(state);
    expect(alive(state, "p2")).toBe(false);
    state = voteAll(expire(state), { p1: null, p3: null, p4: null, p5: null, p6: null });
    state = toTurn(state, "WEREWOLF");
    expect(() => act(state, "p1", { type: "wolf-target", targetId: "p3" })).toThrow("tertular penyakit");
    state = finishNight(state);
    expect(state.public.log.at(-1)).toMatchObject({ type: "DAWN", night: 2, deaths: [], diseaseBlocked: true });
  });

  it("attacks nobody when the pack splits evenly", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p3" });
    state = act(state, "p2", { type: "wolf-target", targetId: "p4" });
    expect(() => act(state, "p1", { type: "wolf-target", targetId: "p2" })).toThrow("sesama Werewolf");
    state = finishNight(state);
    expect(state.public.players.every((player) => player.alive)).toBe(true);
  });

  it("kills a lover's partner of heartbreak", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "CUPID", "VILLAGER", "VILLAGER", "VILLAGER"])), "CUPID");
    state = act(state, "p2", { type: "night-action", actionType: "CUPID_LINK", targetId: "p3", secondaryTargetId: "p4" });
    state = toTurn(state, "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p3" });
    state = finishNight(state);
    expect(state.public.players.find((player) => player.id === "p4")!.deathReason).toBe("HEARTBREAK");
  });

  it("rejects actions from the wrong role, the wrong turn, or eliminated players", () => {
    let state = toTurn(readyAll(game(BASIC)), "WEREWOLF");
    expect(() => act(state, "p2", { type: "wolf-target", targetId: "p4" })).toThrow("Role kamu");
    expect(() => act(state, "p2", { type: "night-action", actionType: "SEER_INSPECT", targetId: "p1" })).toThrow("Bukan giliran");
    expect(() => applyClassicAction(state, { playerId: "stranger", isHost: false }, { type: "ready" }, { now: NOW })).toThrow("tidak memiliki kursi");
    state = act(state, "p1", { type: "wolf-target", targetId: "p2" });
    state = finishNight(state);
    state = expire(state);
    expect(() => act(state, "p2", { type: "vote", targetId: "p1" })).toThrow("tereliminasi");
  });

  it("never mutates the input state", () => {
    const state = toTurn(readyAll(game(BASIC)), "WEREWOLF");
    const snapshot = JSON.stringify(state);
    act(state, "p1", { type: "wolf-target", targetId: "p4" });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("Hunter", () => {
  it("shoots after dying at night, then the day starts", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p2" });
    state = finishNight(state);
    expect(state.public.phase).toBe("HUNTER_REVENGE");
    expect(() => act(state, "p3", { type: "hunter-shot", targetId: "p1" })).toThrow("Bukan giliran Hunter");
    state = act(state, "p2", { type: "hunter-shot", targetId: "p3" });
    expect(alive(state, "p3")).toBe(false);
    expect(state.public.phase).toBe("DAY_DISCUSSION");
  });

  it("can end the game with the shot and loses the shot on timeout", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = finishNight(state);
    state = voteAll(expire(state), { p1: "p2", p2: "p3", p3: "p2", p4: "p2", p5: "p2", p6: "p2" });
    expect(state.public.phase).toBe("HUNTER_REVENGE");
    const shot = act(state, "p2", { type: "hunter-shot", targetId: "p1" });
    expect(shot.public.phase).toBe("GAME_OVER");
    expect(shot.public.winner?.faction).toBe("VILLAGER");
    const timedOut = expire(state);
    expect(timedOut.public.phase).toBe("NIGHT_INTRO");
    expect(timedOut.public.log.at(-1)).toMatchObject({ type: "HUNTER", hunterId: "p2", targetId: null });
  });
});

describe("day voting", () => {
  it("hides votes until everyone has voted, then reveals the matrix and executes", () => {
    let state = expire(finishNight(readyAll(game(BASIC))));
    expect(state.public.phase).toBe("OPEN_VOTING");
    state = act(state, "p2", { type: "vote", targetId: "p4" });
    expect(state.public.votedPlayerIds).toEqual(["p2"]);
    expect(state.public.lastVoteReveal).toBeNull();
    expect(JSON.stringify(state.public)).not.toContain("\"p2\",\"targetId\"");
    state = voteAll(state, { p1: "p4", p3: "p4", p4: "p1", p5: null });
    expect(state.public.lastVoteReveal).toContainEqual({ voterId: "p4", targetId: "p1", weight: 1 });
    expect(state.public.players.find((player) => player.id === "p4")!.deathReason).toBe("EXECUTION");
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(state.public.nightNumber).toBe(2);
  });

  it("counts the Mayor's vote twice", () => {
    let state = expire(finishNight(readyAll(game(["WEREWOLF", "MAYOR", "VILLAGER", "VILLAGER", "VILLAGER"]))));
    state = voteAll(state, { p1: "p3", p3: "p1", p2: "p1", p4: null, p5: null });
    expect(alive(state, "p1")).toBe(false);
    expect(state.public.winner?.faction).toBe("VILLAGER");
  });

  it("runs defense and a restricted revote on a tie, and skips execution on a second tie", () => {
    let state = expire(finishNight(readyAll(game(["WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]))));
    state = voteAll(state, { p1: "p2", p2: "p3", p3: "p2", p4: "p3", p5: null, p6: null });
    expect(state.public.phase).toBe("TIE_DEFENSE");
    expect(Date.parse(state.public.phaseDeadlineAt!) - Date.parse(state.public.actionStartsAt!)).toBe(180_000);
    expect(state.public.tiedPlayerIds.sort()).toEqual(["p2", "p3"]);
    state = expire(state);
    expect(state.public.phase).toBe("TIE_REVOTE");
    expect(() => act(state, "p1", { type: "vote", targetId: "p4" })).toThrow("kandidat yang seri");
    state = voteAll(state, { p1: "p2", p2: "p3", p3: "p2", p4: "p3", p5: null, p6: null });
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(state.public.players.every((player) => player.alive)).toBe(true);
    expect(state.public.log.at(-1)).toMatchObject({ type: "EXECUTION", playerId: null });
  });

  it("moves to voting early when a majority skips discussion, or when time runs out", () => {
    let state = finishNight(readyAll(game(BASIC)));
    state = act(state, "p1", { type: "skip-discussion" });
    state = act(state, "p2", { type: "skip-discussion" });
    expect(state.public.phase).toBe("DAY_DISCUSSION");
    state = act(state, "p3", { type: "skip-discussion" });
    expect(state.public.phase).toBe("OPEN_VOTING");
    expect(expire(finishNight(readyAll(game(BASIC)))).public.phase).toBe("OPEN_VOTING");
  });
});

describe("win conditions", () => {
  it("lets the Tanner win immediately when executed", () => {
    let state = expire(finishNight(readyAll(game(["WEREWOLF", "TANNER", "VILLAGER", "VILLAGER", "VILLAGER"]))));
    state = voteAll(state, { p1: "p2", p3: "p2", p4: "p2", p2: null, p5: null });
    expect(state.public.winner).toEqual({ faction: "TANNER", playerIds: ["p2"] });
    expect(state.public.phase).toBe("GAME_OVER");
  });

  it("gives Werewolves the win at parity", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER"])), "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p3" });
    state = finishNight(state);
    expect(state.public.winner?.faction).toBe("WEREWOLF");
    expect(state.public.winner?.playerIds.sort()).toEqual(["p1", "p2"]);
  });

  it("gives cross-team Lovers the win as the final two", () => {
    let state = toTurn(readyAll(game(["WEREWOLF", "CUPID", "VILLAGER", "VILLAGER", "VILLAGER"])), "CUPID");
    state = act(state, "p2", { type: "night-action", actionType: "CUPID_LINK", targetId: "p1", secondaryTargetId: "p3" });
    state = toTurn(state, "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p4" });
    state = finishNight(state);
    state = voteAll(expire(state), { p1: "p5", p2: "p5", p3: "p5", p5: null });
    state = toTurn(state, "WEREWOLF");
    state = act(state, "p1", { type: "wolf-target", targetId: "p2" });
    state = finishNight(state);
    expect(state.public.winner).toEqual({ faction: "LOVERS", playerIds: ["p1", "p3"] });
  });
});

describe("AFK handling (Paksa Lanjut)", () => {
  it("is host-only", () => {
    const state = toTurn(readyAll(game(BASIC)), "DOCTOR");
    expect(() => act(state, "p2", { type: "force-advance" })).toThrow("Hanya host");
  });

  it("promotes an online Villager, demotes the AFK player, and removes their next vote", () => {
    let state = toTurn(readyAll(game(BASIC)), "DOCTOR");
    state = act(state, "p1", { type: "force-advance" }, { onlinePlayerIds: ["p1", "p2", "p3", "p5"], random: () => 0 });
    expect(state.secret.roles.p3).toBe("VILLAGER");
    expect(state.secret.roles.p5).toBe("DOCTOR");
    expect(state.secret.notices).toContainEqual({ playerId: "p5", message: expect.stringContaining("Guardian Angel") });
    expect(state.public.players.find((player) => player.id === "p3")!.hasAfkPenalty).toBe(true);
    expect(activeNightRole(state)).toBe("SEER");
    state = expire(finishNight(state));
    expect(state.public.players.find((player) => player.id === "p3")!.canVote).toBe(false);
    expect(() => act(state, "p3", { type: "vote", targetId: "p1" })).toThrow("dicabut");
    state = voteAll(state, { p1: null, p2: null, p4: null, p5: null });
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(state.public.players.find((player) => player.id === "p3")!.hasAfkPenalty).toBe(false);
  });

  it("eliminates on a second strike without using the day's execution", () => {
    let state = expire(finishNight(readyAll(game(["WEREWOLF", "SEER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]))));
    // Strike 1: the Seer does not vote and the host forces the reveal.
    state = voteAll(state, { p1: null, p3: null, p4: null, p5: null, p6: null });
    state = act(state, "p1", { type: "force-advance" });
    expect(state.public.players.find((player) => player.id === "p2")!.hasAfkPenalty).toBe(true);
    // Strike 2: AFK again on the next night's Seer turn.
    state = toTurn(state, "SEER");
    state = act(state, "p1", { type: "force-advance" });
    expect(state.public.players.find((player) => player.id === "p2")!.deathReason).toBe("DEAD_AFK");
    expect(state.secret.roles.p2).toBe("SEER");
    expect(state.public.log).toContainEqual({ type: "AFK_ELIM", playerId: "p2", deaths: [{ playerId: "p2", reason: "DEAD_AFK" }] });
    // The village still gets its normal discussion and vote.
    expect(state.public.phase).toBe("DAY_DISCUSSION");
    expect(expire(state).public.phase).toBe("OPEN_VOTING");
  });

  it("does not strike diseased Werewolves or a Witch with no potions", () => {
    const state = toTurn(readyAll(game(["WEREWOLF", "WITCH", "VILLAGER", "VILLAGER", "VILLAGER"])), "WITCH");
    const spent = { ...state, secret: { ...state.secret, witchHealUsed: true, witchPoisonUsed: true } };
    const next = act(spent, "p1", { type: "force-advance" });
    expect(next.public.players.find((player) => player.id === "p2")!.hasAfkPenalty).toBe(false);
    expect(next.secret.roles.p2).toBe("WITCH");
  });

  it("lets an active role pass with SKIP so it is not treated as AFK", () => {
    let state = toTurn(readyAll(game(BASIC)), "DOCTOR");
    state = act(state, "p3", { type: "night-action", actionType: "SKIP" });
    state = act(state, "p1", { type: "force-advance" });
    expect(state.secret.roles.p3).toBe("DOCTOR");
    expect(state.public.players.find((player) => player.id === "p3")!.hasAfkPenalty).toBe(false);
  });
});
