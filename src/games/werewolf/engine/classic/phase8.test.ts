import { describe, expect, it } from "vitest";
import type { ClassicAction, ClassicGameState, ClassicRole, ClassicSettings, NightRole } from "@/games/werewolf/contract";
import { activeNightRole, advanceClassic, applyClassicAction, ClassicRuleError, createClassicGame } from "@/games/werewolf/engine/classic/engine";
import { validateClassicSettings } from "@/games/werewolf/engine/classic/settings";
import { evaluateWinner } from "@/games/werewolf/engine/classic/resolve";

/** Phase 8 roles (docs/02 §2.2, 8.1 and 8.1b). Player pN holds roleList[N-1]; every game is in Advanced mode. */
const NOW = Date.UTC(2026, 10, 25, 20);

function game(roleList: ClassicRole[], overrides: Partial<ClassicSettings> = {}): ClassicGameState {
  const players = roleList.map((_, index) => ({ id: `p${index + 1}`, name: `Pemain ${index + 1}` }));
  const roles: Partial<Record<ClassicRole, number>> = {};
  for (const role of roleList) roles[role] = (roles[role] ?? 0) + 1;
  const state = createClassicGame(players, { roles, deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180, advanced: true, ...overrides }, { now: NOW, random: () => 0 });
  const assigned = Object.fromEntries(players.map((player, index) => [player.id, roleList[index]!])) as Record<string, ClassicRole>;
  return { ...state, secret: { ...state.secret, roles: { ...assigned }, originalRoles: { ...assigned } } };
}

const deadlineOf = (state: ClassicGameState) => Date.parse(state.public.phaseDeadlineAt!);
const act = (state: ClassicGameState, playerId: string, action: ClassicAction) =>
  applyClassicAction(state, { playerId, isHost: playerId === "p1" }, action, { now: state.public.phaseDeadlineAt ? deadlineOf(state) - 1000 : NOW });
const expire = (state: ClassicGameState) => {
  const next = advanceClassic(state, deadlineOf(state));
  if (!next) throw new Error(`phase ${state.public.phase} did not advance`);
  return next;
};
const readyAll = (state: ClassicGameState) => state.public.players.reduce((current, player) => act(current, player.id, { type: "ready" }), state);
function toTurn(state: ClassicGameState, role: NightRole) {
  let current = state;
  for (let guard = 0; guard < 14 && activeNightRole(current) !== role; guard += 1) current = expire(current);
  expect(activeNightRole(current)).toBe(role);
  return current;
}
function finishNight(state: ClassicGameState) {
  let current = state;
  for (let guard = 0; guard < 14 && (current.public.phase === "NIGHT_INTRO" || current.public.phase === "NIGHT_TURN"); guard += 1) current = expire(current);
  return current;
}
const night = (list: ClassicRole[]) => readyAll(game(list));
const alive = (state: ClassicGameState, id: string) => state.public.players.find((player) => player.id === id)!.alive;
const voteAll = (state: ClassicGameState, votes: Record<string, string | null>) => Object.entries(votes).reduce((current, [voter, target]) => act(current, voter, { type: "vote", targetId: target }), state);
const toVoting = (state: ClassicGameState) => expire(state);

describe("settings", () => {
  it("keeps every Phase 8 role except the Apprentice Seer behind Advanced mode", () => {
    const base = { deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180 } as const;
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, APPRENTICE_SEER: 1, VILLAGER: 3 } }, 5)).not.toThrow();
    for (const role of ["PRINCE", "TROUBLEMAKER", "SPELLCASTER", "LONE_WOLF", "VAMPIRE", "ALPHA_WOLF", "SORCERER", "WOLF_CUB", "DIRE_WOLF", "DREAM_WOLF"] as const) {
      expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, [role]: 1, VILLAGER: 3 } }, 5), role).toThrow("mode lanjutan");
      expect(() => validateClassicSettings({ ...base, advanced: true, roles: { WEREWOLF: 1, [role]: 1, VILLAGER: 3 } }, 5), role).not.toThrow();
    }
  });

  it("needs a wolf that wakes and counts the whole pack against the other players", () => {
    const base = { deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180, advanced: true } as const;
    expect(() => validateClassicSettings({ ...base, roles: { DREAM_WOLF: 1, VILLAGER: 4 } }, 5)).toThrow("bangun");
    expect(() => validateClassicSettings({ ...base, roles: { LONE_WOLF: 1, VILLAGER: 4 } }, 5)).not.toThrow();
    expect(() => validateClassicSettings({ ...base, roles: { WEREWOLF: 1, ALPHA_WOLF: 1, DREAM_WOLF: 1, VILLAGER: 3 } }, 6)).toThrow("lebih sedikit");
  });

  it("puts the wolf-side turns in the night queue only when their roles are present", () => {
    const state = night(["ALPHA_WOLF", "SORCERER", "DIRE_WOLF", "SEER", "VILLAGER", "VILLAGER"]);
    expect(state.public.nightQueue).toEqual(["DIRE_WOLF", "WEREWOLF", "SORCERER", "SEER"]);
    expect(night(["DREAM_WOLF", "LONE_WOLF", "VILLAGER", "VILLAGER", "VILLAGER"]).public.nightQueue).toEqual(["WEREWOLF"]);
  });
});

describe("Apprentice Seer and Sorcerer", () => {
  it("the Apprentice reads only once no Seer is alive, and the pack, Lycan and Lone Wolf read as Werewolf", () => {
    let state = toTurn(night(["WEREWOLF", "SEER", "APPRENTICE_SEER", "LYCAN", "LONE_WOLF", "SORCERER", "VILLAGER", "VILLAGER"]), "APPRENTICE_SEER");
    expect(() => act(state, "p3", { type: "night-action", actionType: "SEER_INSPECT", targetId: "p4" })).toThrow("Seer masih hidup");
    state = { ...state, public: { ...state.public, players: state.public.players.map((player) => player.id === "p2" ? { ...player, alive: false } : player) } };
    for (const [target, appearsAs] of [["p4", "WEREWOLF"], ["p5", "WEREWOLF"], ["p6", "VILLAGER"], ["p7", "VILLAGER"]] as const) {
      const read = act(toTurn(state, "APPRENTICE_SEER"), "p3", { type: "night-action", actionType: "SEER_INSPECT", targetId: target });
      expect(read.secret.seerResults.at(-1)).toMatchObject({ seerId: "p3", targetId: target, appearsAs });
    }
  });

  it("the Sorcerer learns only whether the target is a Seer", () => {
    const state = toTurn(night(["WEREWOLF", "SEER", "APPRENTICE_SEER", "SORCERER", "VILLAGER", "VILLAGER"]), "SORCERER");
    expect(() => act(state, "p4", { type: "night-action", actionType: "SORCERER_INSPECT", targetId: "p4" })).toThrow("dirimu");
    const found = act(state, "p4", { type: "night-action", actionType: "SORCERER_INSPECT", targetId: "p2" });
    expect(found.secret.sorcererResults).toEqual([{ sorcererId: "p4", night: 1, targetId: "p2", isSeer: true }]);
    expect(() => act(found, "p4", { type: "night-action", actionType: "SORCERER_INSPECT", targetId: "p5" })).toThrow("sudah menerawang");
    expect(act(state, "p4", { type: "night-action", actionType: "SORCERER_INSPECT", targetId: "p5" }).secret.sorcererResults[0]?.isSeer).toBe(false);
    expect(() => act(state, "p1", { type: "night-action", actionType: "SORCERER_INSPECT", targetId: "p5" })).toThrow();
  });
});

describe("pack roles", () => {
  it("lets the Alpha Wolf convert a victim once instead of killing, and a protected victim does not use it up", () => {
    let state = toTurn(night(["ALPHA_WOLF", "WEREWOLF", "DOCTOR", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF");
    expect(() => act(state, "p2", { type: "wolf-target", targetId: "p4", convert: true })).toThrow("Hanya Alpha Wolf");
    state = act(act(state, "p1", { type: "wolf-target", targetId: "p4", convert: true }), "p2", { type: "wolf-target", targetId: "p4" });
    state = finishNight(state);
    expect(alive(state, "p4")).toBe(true);
    expect(state.secret.roles.p4).toBe("WEREWOLF");
    expect(state.secret.alphaUsed).toBe(true);
    expect(state.secret.notices.some((notice) => notice.playerId === "p4")).toBe(true);

    // A protected victim is spared and the conversion is kept for later.
    let guarded = toTurn(night(["ALPHA_WOLF", "WEREWOLF", "DOCTOR", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF");
    guarded = act(act(guarded, "p1", { type: "wolf-target", targetId: "p4", convert: true }), "p2", { type: "wolf-target", targetId: "p4" });
    guarded = act(toTurn(guarded, "DOCTOR"), "p3", { type: "night-action", actionType: "DOCTOR_PROTECT", targetId: "p4" });
    guarded = finishNight(guarded);
    expect(guarded.secret.alphaUsed).toBe(false);
    expect(guarded.secret.roles.p4).toBe("VILLAGER");

    // A second try after the conversion is spent.
    expect(() => act(toTurn(night(["ALPHA_WOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF"), "p1", { type: "wolf-target", targetId: "p4", convert: true })).not.toThrow();
    expect(() => act({ ...toTurn(night(["ALPHA_WOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF"), secret: { ...state.secret, night: state.secret.night, alphaUsed: true } } as ClassicGameState, "p1", { type: "wolf-target", targetId: "p4", convert: true })).toThrow();
  });

  it("gives the pack two victims the night after a Wolf Cub died, and only then", () => {
    let state = toTurn(night(["WEREWOLF", "WOLF_CUB", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF");
    expect(() => act(state, "p1", { type: "wolf-target", targetId: "p3", secondTargetId: "p4" })).toThrow("Wolf Cub gugur");
    // The cub is executed on day 1.
    state = toVoting(finishNight(act(state, "p1", { type: "wolf-target", targetId: null })));
    state = voteAll(state, { p1: "p2", p2: "p3", p3: "p2", p4: "p2", p5: "p2", p6: "p2", p7: "p2", p8: "p2" });
    expect(alive(state, "p2")).toBe(false);
    expect(state.secret.doubleAttackNight).toBe(2);
    state = toTurn(state, "WEREWOLF");
    expect(() => act(state, "p1", { type: "wolf-target", targetId: "p3", secondTargetId: "p3" })).toThrow("berbeda");
    state = finishNight(act(state, "p1", { type: "wolf-target", targetId: "p3", secondTargetId: "p4" }));
    expect(alive(state, "p3")).toBe(false);
    expect(alive(state, "p4")).toBe(false);
  });

  it("kills the Dire Wolf with its partner, however the partner dies", () => {
    let state = toTurn(night(["DIRE_WOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "DIRE_WOLF");
    expect(() => act(state, "p1", { type: "night-action", actionType: "DIRE_PARTNER", targetId: "p1" })).toThrow("dirimu");
    expect(() => act(state, "p2", { type: "night-action", actionType: "DIRE_PARTNER", targetId: "p3" })).toThrow("Role kamu");
    state = act(state, "p1", { type: "night-action", actionType: "DIRE_PARTNER", targetId: "p3" });
    expect(state.secret.direBond).toEqual({ direId: "p1", partnerId: "p3" });
    state = finishNight(act(toTurn(state, "WEREWOLF"), "p2", { type: "wolf-target", targetId: "p3" }));
    expect(alive(state, "p3")).toBe(false);
    expect(alive(state, "p1")).toBe(false);
    expect(state.public.players.find((player) => player.id === "p1")?.deathReason).toBe("BOND");
  });

  it("lets the Dream Wolf sleep but still count as a Werewolf", () => {
    const state = toTurn(night(["WEREWOLF", "DREAM_WOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]), "WEREWOLF");
    expect(() => act(state, "p2", { type: "wolf-target", targetId: "p3" })).toThrow("Role kamu");
    const dead = { ...state, public: { ...state.public, players: state.public.players.map((player) => player.id === "p1" ? { ...player, alive: false } : player) } };
    expect(evaluateWinner(dead)).toBeNull();
    const both = { ...dead, public: { ...dead.public, players: dead.public.players.map((player) => player.id === "p2" ? { ...player, alive: false } : player) } };
    expect(evaluateWinner(both)?.faction).toBe("VILLAGER");
  });

  it("makes a lone Lone Wolf win alone, but the pack win when other wolves live", () => {
    const base = night(["LONE_WOLF", "WEREWOLF", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]);
    const kill = (state: ClassicGameState, ids: string[]) => ({ ...state, public: { ...state.public, players: state.public.players.map((player) => ids.includes(player.id) ? { ...player, alive: false } : player) } });
    expect(evaluateWinner(kill(base, ["p2", "p3", "p4", "p5"]))).toEqual({ faction: "LONE_WOLF", playerIds: ["p1"] });
    const pack = evaluateWinner(kill(base, ["p3", "p4", "p5"]));
    expect(pack?.faction).toBe("WEREWOLF");
    expect(pack?.playerIds).toEqual(["p2"]);
  });
});

describe("Vampire, Spellcaster and Prince", () => {
  const list: ClassicRole[] = ["VAMPIRE", "WEREWOLF", "SPELLCASTER", "PRINCE", "VILLAGER", "VILLAGER", "VILLAGER"];

  it("makes the Vampire immune to the pack and doomed players fall after the vote", () => {
    let state = toTurn(night(list), "WEREWOLF");
    state = act(state, "p2", { type: "wolf-target", targetId: "p1" });
    state = act(toTurn(state, "SPELLCASTER"), "p3", { type: "night-action", actionType: "SPELLCASTER_SILENCE", targetId: "p5" });
    state = act(toTurn(state, "VAMPIRE"), "p1", { type: "night-action", actionType: "VAMPIRE_BITE", targetId: "p6" });
    state = finishNight(state);
    expect(state.public.phase).toBe("DAY_DISCUSSION");
    expect(alive(state, "p1")).toBe(true);
    expect(state.public.silencedId).toBe("p5");
    expect(state.public.doomedIds).toEqual(["p6"]);
    state = voteAll(toVoting(state), { p1: "p7", p2: "p7", p3: "p7", p4: "p7", p5: "p7", p6: "p7", p7: "p1" });
    expect(alive(state, "p7")).toBe(false);
    expect(alive(state, "p6")).toBe(false);
    expect(state.public.doomedIds).toEqual([]);
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(state.public.silencedId).toBeNull();
  });

  it("lets the Doctor stop a bite and ends the game for the Vampire at two survivors", () => {
    const base = night(["VAMPIRE", "WEREWOLF", "DOCTOR", "VILLAGER", "VILLAGER", "VILLAGER"]);
    let state = act(toTurn(base, "DOCTOR"), "p3", { type: "night-action", actionType: "DOCTOR_PROTECT", targetId: "p4" });
    state = finishNight(act(toTurn(state, "VAMPIRE"), "p1", { type: "night-action", actionType: "VAMPIRE_BITE", targetId: "p4" }));
    expect(state.public.doomedIds).toEqual([]);
    const two = { ...base, public: { ...base.public, players: base.public.players.map((player) => ["p3", "p4", "p5", "p6"].includes(player.id) ? { ...player, alive: false } : player) } };
    expect(evaluateWinner(two)).toEqual({ faction: "VAMPIRE", playerIds: ["p1"] });
    // With the Vampire gone the pack still has to be beaten.
    const vampireDead = { ...base, public: { ...base.public, players: base.public.players.map((player) => player.id === "p1" ? { ...player, alive: false } : player) } };
    expect(evaluateWinner(vampireDead)).toBeNull();
  });

  it("spares a Prince from one execution and reveals him; the next one kills him", () => {
    let state = finishNight(night(["WEREWOLF", "PRINCE", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]));
    state = voteAll(toVoting(state), { p1: "p2", p2: "p3", p3: "p2", p4: "p2", p5: "p2", p6: "p2", p7: "p2" });
    expect(alive(state, "p2")).toBe(true);
    expect(state.public.revealedPrinceIds).toEqual(["p2"]);
    expect(state.public.log.some((entry) => entry.type === "PRINCE")).toBe(true);
    expect(state.public.phase).toBe("NIGHT_INTRO");
    state = voteAll(toVoting(finishNight(state)), { p1: "p2", p2: "p3", p3: "p2", p4: "p2", p5: "p2", p6: "p2", p7: "p2" });
    expect(alive(state, "p2")).toBe(false);
  });
});

describe("Troublemaker", () => {
  const list: ClassicRole[] = ["WEREWOLF", "TROUBLEMAKER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"];

  it("calls a second vote once per game, after the first execution", () => {
    let state = toVoting(finishNight(night(list)));
    expect(() => act(state, "p3", { type: "second-vote" })).toThrow("Hanya Troublemaker");
    state = act(state, "p2", { type: "second-vote" });
    expect(state.public.secondVoteQueued).toBe(true);
    expect(() => act(state, "p2", { type: "second-vote" })).toThrow("sudah memakai");
    state = voteAll(state, { p1: "p3", p2: "p3", p3: "p4", p4: "p3", p5: "p3", p6: "p3", p7: "p3" });
    expect(alive(state, "p3")).toBe(false);
    expect(state.public.phase).toBe("OPEN_VOTING");
    expect(state.public.secondVoteQueued).toBe(false);
    state = voteAll(state, { p1: "p4", p2: "p4", p4: "p5", p5: "p4", p6: "p4", p7: "p4" });
    expect(alive(state, "p4")).toBe(false);
    expect(state.public.phase).toBe("NIGHT_INTRO");
    expect(() => act(toVoting(finishNight(state)), "p2", { type: "second-vote" })).toThrow("sudah memakai");
  });

  it("is refused outside the first vote, for a dead Troublemaker, or at game end", () => {
    const day = finishNight(night(list));
    expect(() => act(day, "p2", { type: "second-vote" })).toThrow(ClassicRuleError);
  });
});
