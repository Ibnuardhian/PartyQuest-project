import { z } from "zod";
import { cluePassesForRound, DEFAULT_CLUE_MINUTES, isClueMinutesOption } from "@/games/undercover/contract";
import type {
  GameAction,
  GameDefinition,
  GameSettings,
  GameState,
  Player,
  PlayerView,
  PublicState,
  Role,
  Winner,
} from "@/games/undercover/contract";
import { getWordPairs } from "@/games/undercover/words";

const settingsSchema = z.object({
  category: z.enum(["makanan", "hewan", "benda", "tempat", "pekerjaan", "campuran"]),
  undercoverCount: z.number().int().min(1).max(4),
  mrWhiteEnabled: z.boolean(),
  clueMinutes: z.number().refine(isClueMinutesOption, "Waktu clue harus 1, 3, atau 5 menit.").optional(),
});
const guessSchema = z.string().trim().min(1).max(60);

function randomIndex(max: number): number {
  if (max <= 0) throw new Error("Rentang acak tidak valid.");
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error("Sumber angka acak aman tidak tersedia.");
  const ceiling = Math.floor(0x1_0000_0000 / max) * max;
  const sample = new Uint32Array(1);
  do cryptoApi.getRandomValues(sample); while (sample[0]! >= ceiling);
  return sample[0]! % max;
}

function shuffled<T>(values: readonly T[], pick: (max: number) => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = pick(index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

function validateSettings(input: unknown, playerCount: number): GameSettings {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 12) {
    throw new Error("Jumlah pemain harus 3–12 orang.");
  }
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Pengaturan permainan tidak valid.");
  const opposingRoles = parsed.data.undercoverCount + Number(parsed.data.mrWhiteEnabled);
  if (opposingRoles >= playerCount || playerCount - opposingRoles < 2) {
    throw new Error("Sisakan minimal dua pemain Civilian.");
  }
  return { ...parsed.data, clueMinutes: parsed.data.clueMinutes ?? DEFAULT_CLUE_MINUTES };
}

function countAlive(players: Player[], roles: GameState["secret"]["assignments"]): Record<Role, number> {
  const counts: Record<Role, number> = { civilian: 0, undercover: 0, "mr-white": 0 };
  for (const player of players) {
    if (!player.alive) continue;
    const assignment = roles.find((entry) => entry.playerId === player.id);
    if (assignment) counts[assignment.role] += 1;
  }
  return counts;
}

function endIfWon(state: GameState): GameState {
  const alive = countAlive(state.public.players, state.secret.assignments);
  let winner: Winner | null = null;
  let reason: string | null = null;
  if (alive.undercover === 0 && alive["mr-white"] === 0) {
    winner = "civilian";
    reason = "Semua pemain lawan telah tereliminasi.";
  } else if (alive.undercover > 0 && alive.undercover >= alive.civilian) {
    winner = "undercover";
    reason = "Jumlah Undercover menyamai atau melebihi Civilian yang tersisa.";
  } else if (alive["mr-white"] === 1 && alive.civilian === 0 && alive.undercover === 0) {
    winner = "mr-white";
    reason = "Mr. White menjadi pemain terakhir yang bertahan.";
  }
  if (!winner) return state;
  return { ...state, public: { ...state.public, phase: "finished", clueDeadlineAt: null, winner, resultReason: reason } };
}

function deadlineAfter(now: number, settings: GameSettings): string {
  return new Date(now + (settings.clueMinutes ?? DEFAULT_CLUE_MINUTES) * 60_000).toISOString();
}

function resolveVotes(state: GameState, now: number): GameState {
  const counts = new Map<string, number>();
  for (const target of Object.values(state.public.votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const highest = Math.max(0, ...counts.values());
  const tied = [...counts].filter(([, count]) => count === highest).map(([id]) => id);
  if (tied.length !== 1 || highest === 0) {
    if (!state.public.revoteUsed && tied.length > 1) {
      return { ...state, public: { ...state.public, phase: "revote", tiedPlayerIds: tied, votes: {}, revoteUsed: true, eliminatedPlayerId: null } };
    }
    return { ...state, public: { ...state.public, phase: "clue", round: state.public.round + 1, clueIndex: 0, clueDeadlineAt: deadlineAfter(now, state.settings), clues: [], votes: {}, tiedPlayerIds: [], eliminatedPlayerId: null, lastRoundTied: true } };
  }
  const eliminatedPlayerId = tied[0]!;
  const players = state.public.players.map((player) => player.id === eliminatedPlayerId ? { ...player, alive: false } : player);
  const eliminatedRole = state.secret.assignments.find((item) => item.playerId === eliminatedPlayerId)?.role;
  const next: GameState = {
    ...state,
    public: { ...state.public, players, eliminatedPlayerId, votes: {}, tiedPlayerIds: [], lastRoundTied: false },
  };
  if (eliminatedRole === "mr-white") return { ...next, public: { ...next.public, phase: "mr-white-guess" } };
  return endIfWon({ ...next, public: { ...next.public, phase: "clue", round: next.public.round + 1, clueIndex: 0, clueDeadlineAt: deadlineAfter(now, state.settings), clues: [] } });
}

/**
 * Ends the running timed clue window (the server calls this when its deadline passes). Every round has a
 * single window, so the table moves straight to voting.
 */
export function endClueWindow(state: GameState, now: number): GameState {
  if (state.public.phase !== "clue") throw new Error("Ronde petunjuk tidak aktif.");
  const clueIndex = state.public.clueIndex + 1;
  const more = clueIndex < cluePassesForRound(state.public.round);
  if (more) return { ...state, public: { ...state.public, clueIndex, clueDeadlineAt: deadlineAfter(now, state.settings) } };
  // The timed window is the whole clue phase: when it ends the table votes right away.
  return openVoting({ ...state, public: { ...state.public, clueIndex } });
}

/** Moves a running clue window straight into voting (timer end, host veto, or a majority of vote requests). */
export function openVoting(state: GameState): GameState {
  return { ...state, public: { ...state.public, phase: "voting", clueDeadlineAt: null, votes: {}, revoteUsed: false, tiedPlayerIds: [], voteRequests: [] } };
}

/** Finish the spoken clue window before players vote away from the device. */
export function finishOfflineClueRound(state: GameState): GameState {
  if (state.public.phase !== "clue") throw new Error("Ronde petunjuk tidak aktif.");
  return { ...state, public: { ...state.public, phase: "voting", clueDeadlineAt: null } };
}

/** Apply the elimination players agreed on offline, then continue normal role rules. */
export function confirmOfflineElimination(state: GameState, playerId: string, now = Date.now()): GameState {
  if (state.public.phase !== "voting") throw new Error("Konfirmasi eliminasi tidak tersedia saat ini.");
  const target = state.public.players.find((player) => player.id === playerId && player.alive);
  if (!target) throw new Error("Pemain aktif tidak ditemukan.");
  const players = state.public.players.map((player) => player.id === playerId ? { ...player, alive: false } : player);
  const eliminatedRole = state.secret.assignments.find((item) => item.playerId === playerId)?.role;
  const next: GameState = {
    ...state,
    public: { ...state.public, players, eliminatedPlayerId: playerId, votes: {}, tiedPlayerIds: [], lastRoundTied: false },
  };
  if (eliminatedRole === "mr-white") return { ...next, public: { ...next.public, phase: "mr-white-guess" } };
  return endIfWon({ ...next, public: { ...next.public, phase: "clue", round: next.public.round + 1, clueIndex: 0, clueDeadlineAt: deadlineAfter(now, state.settings), clues: [], eliminatedPlayerId: null } });
}

function validateAction(state: GameState, action: GameAction): { valid: true } | { valid: false; error: string } {
  const fail = (error: string) => ({ valid: false as const, error });
  const player = "playerId" in action ? state.public.players.find((item) => item.id === action.playerId) : undefined;
  if ("playerId" in action && (!player || (!player.alive && action.type !== "guess-civilian-word"))) return fail("Pemain tidak aktif atau tidak ditemukan.");
  switch (action.type) {
    case "confirm-reveal":
      return state.public.phase === "reveal" && !state.public.revealedPlayerIds.includes(action.playerId) ? { valid: true } : fail("Kartu sudah dikonfirmasi atau fase pembagian selesai.");
    case "finish-discussion":
      return state.public.phase === "discussion" ? { valid: true } : fail("Diskusi belum dimulai.");
    case "request-vote":
      return state.public.phase === "clue" ? { valid: true } : fail("Usul voting hanya tersedia saat ronde petunjuk.");
    case "cast-vote": {
      if (state.public.phase !== "voting" && state.public.phase !== "revote") return fail("Fase voting sedang tidak aktif.");
      if (state.public.votes[action.playerId]) return fail("Kamu sudah memilih.");
      if (action.playerId === action.targetPlayerId) return fail("Kamu tidak dapat memilih diri sendiri.");
      const target = state.public.players.find((item) => item.id === action.targetPlayerId);
      if (!target?.alive) return fail("Target tidak aktif.");
      if (state.public.phase === "revote" && !state.public.tiedPlayerIds.includes(target.id)) return fail("Pilih salah satu pemain dengan suara seri.");
      return { valid: true };
    }
    case "guess-civilian-word":
      return state.public.phase === "mr-white-guess" && action.playerId === state.public.eliminatedPlayerId && guessSchema.safeParse(action.guess).success ? { valid: true } : fail("Tebakan Mr. White tidak valid.");
    default:
      return fail("Aksi tidak dikenal.");
  }
}

function applyAction(state: GameState, action: GameAction, now = Date.now()): GameState {
  const validation = validateAction(state, action);
  if (!validation.valid) throw new Error(validation.error);
  const current = state.public;
  switch (action.type) {
    case "confirm-reveal": {
      const nextIndex = current.revealIndex + 1;
      const revealedPlayerIds = [...current.revealedPlayerIds, action.playerId];
      const phase = revealedPlayerIds.length >= current.players.filter((player) => player.alive).length ? "clue" : "reveal";
      return { ...state, public: { ...current, revealIndex: nextIndex, revealedPlayerIds, phase, clueDeadlineAt: phase === "clue" ? deadlineAfter(now, state.settings) : null } };
    }
    case "finish-discussion":
      return { ...state, public: { ...current, phase: "voting", votes: {}, revoteUsed: false, tiedPlayerIds: [] } };
    case "request-vote": {
      const requested = current.voteRequests ?? [];
      const voteRequests = requested.includes(action.playerId) ? requested.filter((id) => id !== action.playerId) : [...requested, action.playerId];
      const alive = current.players.filter((item) => item.alive).length;
      const next = { ...state, public: { ...current, voteRequests } };
      // A strict majority of the living players opens voting immediately.
      return voteRequests.length * 2 > alive ? openVoting(next) : next;
    }
    case "cast-vote": {
      const votes = { ...current.votes, [action.playerId]: action.targetPlayerId };
      const livingCount = current.players.filter((item) => item.alive).length;
      const completed = Object.keys(votes).length === livingCount;
      const next = { ...state, public: { ...current, votes } };
      return completed ? resolveVotes(next, now) : next;
    }
    case "guess-civilian-word": {
      const correct = action.guess.trim().toLocaleLowerCase("id-ID") === state.secret.civilianWord.toLocaleLowerCase("id-ID");
      const next = { ...state, public: { ...current, winner: correct ? "mr-white" as const : null, resultReason: correct ? "Mr. White berhasil menebak kata Civilian." : null, phase: correct ? "finished" as const : "clue" as const, round: correct ? current.round : current.round + 1, clueIndex: 0, clueDeadlineAt: correct ? null : deadlineAfter(now, state.settings), clues: [], eliminatedPlayerId: null } };
      return correct ? next : endIfWon(next);
    }
  }
}

function getResult(state: GameState): PlayerView["result"] {
  if (state.public.phase !== "finished" || !state.public.winner) return null;
  return { winner: state.public.winner, reason: state.public.resultReason ?? "Permainan selesai.", civilianWord: state.secret.civilianWord, undercoverWord: state.secret.undercoverWord, assignments: state.secret.assignments };
}

function getPlayerView(state: GameState, playerId: string): PlayerView | null {
  if (!state.public.players.some((item) => item.id === playerId)) return null;
  const result = getResult(state);
  const publicState = state.public.phase === "voting" || state.public.phase === "revote"
    ? { ...state.public, votes: {} }
    : state.public;
  return {
    public: publicState,
    private: state.public.phase === "finished" ? null : toCardView(state.secret.assignments.find((item) => item.playerId === playerId)),
    result,
  };
}

/** The role stays server-side (or in the local session); a player's card never carries it. */
function toCardView(assignment: { playerId: string; word: string | null } | undefined) {
  return assignment ? { playerId: assignment.playerId, word: assignment.word } : null;
}

function createInitialState(names: string[], input: GameSettings, pick = randomIndex, playerIds?: string[]): GameState {
  const settings = validateSettings(input, names.length);
  const cleanNames = names.map((name) => name.trim());
  if (cleanNames.some((name) => name.length < 1 || name.length > 24) || new Set(cleanNames.map((name) => name.toLocaleLowerCase("id-ID"))).size !== names.length) {
    throw new Error("Nama pemain harus unik dan terdiri dari 1–24 karakter.");
  }
  const ids = playerIds ?? cleanNames.map((_, index) => `player-${index + 1}`);
  if (ids.length !== cleanNames.length || new Set(ids).size !== ids.length) throw new Error("Identitas pemain tidak valid.");
  const idDeck = shuffled(ids, pick);
  const players = cleanNames.map((name, index) => ({ id: ids[index]!, name, alive: true }));
  const pairs = getWordPairs(settings.category);
  const pair = pairs[pick(pairs.length)];
  if (!pair) throw new Error("Belum ada pasangan kata untuk kategori ini.");
  // Either word of the pair may be the civilian word, so the first word of a pair is not a giveaway.
  const [civilianWord, undercoverWord] = pick(2) === 0 ? pair : [pair[1], pair[0]] as const;
  const shuffledRoles: Role[] = [
    ...Array.from({ length: cleanNames.length - settings.undercoverCount - Number(settings.mrWhiteEnabled) }, () => "civilian" as const),
    ...Array.from({ length: settings.undercoverCount }, () => "undercover" as const),
    ...(settings.mrWhiteEnabled ? ["mr-white" as const] : []),
  ];
  const assignmentsById = new Map<string, Role>();
  shuffled(idDeck, pick).forEach((id, index) => assignmentsById.set(id, shuffledRoles[index]!));
  const assignments = players.map((player) => {
    const role = assignmentsById.get(player.id)!;
    return { playerId: player.id, role, word: role === "civilian" ? civilianWord : role === "undercover" ? undercoverWord : null };
  });
  const publicState: PublicState = {
    phase: "reveal", players, round: 1, revealIndex: 0, revealedPlayerIds: [], clueIndex: 0, clueDeadlineAt: null, clueMinutes: settings.clueMinutes, clues: [], votes: {}, tiedPlayerIds: [],
    revoteUsed: false, eliminatedPlayerId: null, winner: null, resultReason: null, lastRoundTied: false, voteRequests: [],
  };
  return { public: publicState, secret: { civilianWord, undercoverWord, assignments }, settings };
}

export const undercoverGame: GameDefinition = {
  key: "undercover", minPlayers: 3, maxPlayers: 12, validateSettings, createInitialState,
  validateAction, applyAction, getPlayerView, getResult,
};
