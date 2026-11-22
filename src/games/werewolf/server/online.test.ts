import { describe, expect, it } from "vitest";
import { OnlineGameError, type StoredSession } from "@/games/online-game";
import type { ClassicPublicState, ClassicRole } from "@/games/werewolf/contract";
import { DEFAULT_ROOM_SETTINGS, restoreClassic, werewolfOnline } from "@/games/werewolf/server/online";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = Date.UTC(2026, 10, 23, 19);

type View = NonNullable<ReturnType<typeof werewolfOnline.view>> & {
  public: { phase: string; activeNightRole: string | null; players: Array<{ id: string; death: string | null }>; finalRoles: unknown; log: Array<{ type: string }>; phaseDeadlineAt: string | null };
  knownRoles: Record<string, ClassicRole>;
  wolfTargets: Record<string, string | null> | null;
  witch: { victimId: string | null } | null;
  you: { role: ClassicRole; alive: boolean };
};

/** Session where player uuid(N) holds roleList[N-1]; uuid(1) is the host. */
function session(roleList: ClassicRole[], deadRevealMode: "KEEP_HIDDEN" | "SPECTATOR_REVEAL" = "KEEP_HIDDEN"): StoredSession {
  const members = roleList.map((_, index) => ({ userId: uuid(index + 1), displayName: `Pemain ${index + 1}` }));
  const roles: Partial<Record<ClassicRole, number>> = {};
  for (const role of roleList) roles[role] = (roles[role] ?? 0) + 1;
  const settings = { ...DEFAULT_ROOM_SETTINGS, roles, deadRevealMode };
  const round = werewolfOnline.createRound(members, settings);
  const stored = { publicState: round.publicState, secretState: round.secretState, settings };
  const state = restoreClassic(stored);
  const assigned = Object.fromEntries(members.map((member, index) => [member.userId, roleList[index]!])) as Record<string, ClassicRole>;
  return { ...stored, secretState: { secret: { ...state.secret, roles: { ...assigned }, originalRoles: { ...assigned } }, settings: state.settings } };
}

function act(stored: StoredSession, n: number, intent: unknown, isHost = n === 1): StoredSession {
  const pub = stored.publicState as ClassicPublicState;
  const now = pub.phaseDeadlineAt ? Date.parse(pub.phaseDeadlineAt) - 1000 : NOW;
  const next = werewolfOnline.applyIntent(stored, intent, { userId: uuid(n), isHost, now, onlineUserIds: pub.players.map((player) => player.id) });
  return { ...stored, publicState: next.publicState, secretState: next.secretState ?? stored.secretState };
}

function expire(stored: StoredSession): StoredSession {
  const pub = stored.publicState as ClassicPublicState;
  const next = werewolfOnline.advance(stored, Date.parse(pub.phaseDeadlineAt!));
  if (!next) throw new Error("did not advance");
  return { ...stored, publicState: next.publicState, secretState: next.secretState ?? stored.secretState };
}

const view = (stored: StoredSession, n: number, isHost = false) => werewolfOnline.view(stored, { userId: uuid(n), isHost }) as View;
const readyAll = (stored: StoredSession, count: number) => Array.from({ length: count }, (_, index) => index + 1).reduce((current, n) => act(current, n, { type: "ready" }), stored);
function toTurn(stored: StoredSession, role: string) {
  let current = stored;
  for (let guard = 0; guard < 10 && view(current, 1).public.activeNightRole !== role; guard += 1) current = expire(current);
  return current;
}
function finishNight(stored: StoredSession) {
  let current = stored;
  for (let guard = 0; guard < 10 && ["NIGHT_INTRO", "NIGHT_TURN"].includes((current.publicState as ClassicPublicState).phase); guard += 1) current = expire(current);
  return current;
}
function gameError(fn: () => unknown): OnlineGameError {
  try { fn(); } catch (error) { if (error instanceof OnlineGameError) return error; throw error; }
  throw new Error("expected OnlineGameError");
}

describe("Werewolf room settings", () => {
  it("accepts AUTO and sensible custom compositions, rejects bad ones", () => {
    expect(werewolfOnline.parseSettings(werewolfOnline.defaultSettings!())).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(werewolfOnline.parseSettings({ ...DEFAULT_ROOM_SETTINGS, roles: { WEREWOLF: 1, SEER: 1, VILLAGER: 3 } })).toMatchObject({ roles: { WEREWOLF: 1 } });
    expect(gameError(() => werewolfOnline.parseSettings({ ...DEFAULT_ROOM_SETTINGS, roles: { VILLAGER: 5 } })).message).toContain("Werewolf");
    expect(gameError(() => werewolfOnline.parseSettings({ ...DEFAULT_ROOM_SETTINGS, roles: { WEREWOLF: 1, VILLAGER: 2 } })).message).toContain("5–16");
    expect(gameError(() => werewolfOnline.parseSettings({ ...DEFAULT_ROOM_SETTINGS, roles: { WEREWOLF: 1, SEER: 2, VILLAGER: 3 } })).message).toContain("Seer maksimal 1");
    expect(gameError(() => werewolfOnline.parseSettings({ ...DEFAULT_ROOM_SETTINGS, extra: true })).code).toBe("invalid_input");
  });

  it("resolves AUTO for the real player count and checks custom compositions at start", () => {
    const members = Array.from({ length: 7 }, (_, index) => ({ userId: uuid(index + 1), displayName: `P${index}` }));
    const round = werewolfOnline.createRound(members, DEFAULT_ROOM_SETTINGS);
    const state = restoreClassic({ publicState: round.publicState, secretState: round.secretState, settings: DEFAULT_ROOM_SETTINGS });
    expect(Object.values(state.settings.roles).reduce((sum, count) => sum + (count ?? 0), 0)).toBe(7);
    expect(round.playerPrivate).toHaveLength(7);
    const error = gameError(() => werewolfOnline.createRound(members, { ...DEFAULT_ROOM_SETTINGS, roles: { WEREWOLF: 1, VILLAGER: 4 } }));
    expect(error.code).toBe("invalid_settings");
    expect(error.message).toContain("sama dengan jumlah pemain");
  });
});

describe("Werewolf views (privacy)", () => {
  const ROLES: ClassicRole[] = ["WEREWOLF", "WEREWOLF", "MINION", "SEER", "MASON", "MASON", "WITCH", "VILLAGER", "VILLAGER"];

  it("shows a Villager only their own role", () => {
    const state = readyAll(session(ROLES), 9);
    const villager = view(state, 8);
    expect(villager.knownRoles).toEqual({ [uuid(8)]: "VILLAGER" });
    expect(villager.wolfTargets).toBeNull();
    expect(villager.public.finalRoles).toBeNull();
  });

  it("lets Werewolves see each other, the Minion see the Werewolves, but not the reverse", () => {
    const state = readyAll(session(ROLES), 9);
    expect(view(state, 1).knownRoles).toEqual({ [uuid(1)]: "WEREWOLF", [uuid(2)]: "WEREWOLF" });
    expect(view(state, 3).knownRoles).toEqual({ [uuid(1)]: "WEREWOLF", [uuid(2)]: "WEREWOLF", [uuid(3)]: "MINION" });
  });

  it("reveals Masons to each other from their night-1 turn", () => {
    let state = readyAll(session(ROLES), 9);
    expect(view(state, 5).knownRoles).toEqual({ [uuid(5)]: "MASON" });
    state = toTurn(state, "MASON");
    expect(view(state, 5).knownRoles).toEqual({ [uuid(5)]: "MASON", [uuid(6)]: "MASON" });
  });

  it("shows live wolf picks only to Werewolves during their turn, and tonight's victim only to the Witch", () => {
    let state = toTurn(readyAll(session(ROLES), 9), "WEREWOLF");
    state = act(state, 1, { type: "wolf-target", targetId: uuid(8) });
    expect(view(state, 2).wolfTargets).toEqual({ [uuid(1)]: uuid(8) });
    expect(view(state, 3).wolfTargets).toBeNull();
    expect(view(state, 7).witch?.victimId).toBeNull();
    state = toTurn(state, "WITCH");
    expect(view(state, 7).witch?.victimId).toBe(uuid(8));
    expect(view(state, 2).wolfTargets).toBeNull();
  });

  it("hides death causes that would reveal roles", () => {
    let state = toTurn(readyAll(session(ROLES), 9), "WITCH");
    state = act(state, 7, { type: "night-action", actionType: "WITCH_POISON", targetId: uuid(4) });
    state = finishNight(state);
    const seer = view(state, 8).public.players.find((player) => player.id === uuid(4))!;
    expect(seer.death).toBe("NIGHT");
    expect(JSON.stringify(view(state, 8).public)).not.toContain("POISON");
  });

  it("follows deadRevealMode for eliminated players and reveals everything at game over", () => {
    const hidden = finishNight(act(toTurn(readyAll(session(ROLES), 9), "WEREWOLF"), 1, { type: "wolf-target", targetId: uuid(8) }));
    expect(view(hidden, 8).you.alive).toBe(false);
    expect(view(hidden, 8).knownRoles).toEqual({ [uuid(8)]: "VILLAGER" });
    const spectator = finishNight(act(toTurn(readyAll(session(ROLES, "SPECTATOR_REVEAL"), 9), "WEREWOLF"), 1, { type: "wolf-target", targetId: uuid(8) }));
    expect(Object.keys(view(spectator, 8).knownRoles)).toHaveLength(9);
    expect(Object.keys(view(spectator, 9).knownRoles)).toHaveLength(1);
    const tanner = session(["WEREWOLF", "TANNER", "VILLAGER", "VILLAGER", "VILLAGER"]);
    let over = expire(finishNight(readyAll(tanner, 5)));
    for (const n of [1, 3, 4]) over = act(over, n, { type: "vote", targetId: uuid(2) });
    for (const n of [2, 5]) over = act(over, n, { type: "vote", targetId: null });
    expect(view(over, 5).public.finalRoles).toMatchObject({ [uuid(2)]: "TANNER" });
  });

  it("gives the TV no roles before the game ends", () => {
    const state = readyAll(session(ROLES), 9);
    const tv = werewolfOnline.publicView!(state);
    expect(tv.finalRoles).toBeNull();
    expect(JSON.stringify(tv)).not.toContain(uuid(1) + '":"WEREWOLF');
  });

  it("drops secret AFK promotions from the public log", () => {
    let state = toTurn(readyAll(session(ROLES), 9), "SEER");
    state = act(state, 1, { type: "force-advance" });
    expect(restoreClassic(state).public.log.some((entry) => entry.type === "AFK_PROMOTION")).toBe(true);
    expect(view(state, 8).public.log.some((entry) => entry.type === "AFK_PROMOTION")).toBe(false);
  });
});

describe("Werewolf intents", () => {
  const BASIC: ClassicRole[] = ["WEREWOLF", "SEER", "DOCTOR", "VILLAGER", "VILLAGER"];

  it("binds actions to the verified user and rejects spoofed fields or unseated users", () => {
    const state = readyAll(session(BASIC), 4);
    expect(gameError(() => act(state, 5, { type: "ready", playerId: uuid(1) })).code).toBe("invalid_input");
    expect(gameError(() => werewolfOnline.applyIntent(state, { type: "ready" }, { userId: uuid(99), isHost: false, now: NOW, onlineUserIds: [] })).code).toBe("not_a_player");
    expect(gameError(() => act(state, 2, { type: "vote", targetId: "not-a-uuid" })).code).toBe("invalid_input");
  });

  it("returns the engine's reason for invalid actions, including dead players and non-hosts", () => {
    let state = toTurn(readyAll(session(BASIC), 5), "WEREWOLF");
    expect(gameError(() => act(state, 2, { type: "wolf-target", targetId: uuid(4) })).message).toContain("Role kamu");
    expect(gameError(() => act(state, 2, { type: "force-advance" }, false)).message).toContain("Hanya host");
    state = finishNight(act(state, 1, { type: "wolf-target", targetId: uuid(4) }));
    state = expire(state);
    const error = gameError(() => act(state, 4, { type: "vote", targetId: uuid(1) }));
    expect(error.code).toBe("invalid_action");
    expect(error.message).toContain("tereliminasi");
  });

  it("retries only commutative intents on version conflicts", () => {
    for (const type of ["ready", "vote", "wolf-target", "night-action", "skip-discussion"]) expect(werewolfOnline.retryOnConflict!({ type })).toBe(true);
    for (const type of ["force-advance", "hunter-shot"]) expect(werewolfOnline.retryOnConflict!({ type })).toBe(false);
    expect(werewolfOnline.retryOnConflict!(null)).toBe(false);
  });

  it("advances only once the server deadline has passed", () => {
    const state = readyAll(session(BASIC), 5);
    const deadline = Date.parse((state.publicState as ClassicPublicState).phaseDeadlineAt!);
    expect(werewolfOnline.advance(state, deadline - 1)).toBeNull();
    expect(werewolfOnline.advance(state, deadline)?.publicState.phase).toBe("NIGHT_TURN");
  });
});
