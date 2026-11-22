import { z } from "zod";
import { OnlineGameError, type OnlineGameServer, type StoredSession } from "@/games/online-game";
import { CLUE_TURN_DURATION_MS, type GameAction, type GameSettings, type GameState, type PublicState, type SecretState } from "@/games/undercover/contract";
import { undercoverGame } from "@/games/undercover/engine";

/** Undercover adapter for Online Room. Pure functions: no database, no HTTP. */

export const undercoverRoomSettingsSchema = z.object({
  category: z.enum(["makanan", "hewan", "benda", "tempat", "pekerjaan", "campuran"]),
  undercoverCount: z.number().int().min(1).max(4),
  mrWhiteEnabled: z.boolean(),
}).strict();

export const undercoverActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirm-reveal") }).strict(),
  z.object({ type: z.literal("submit-clue") }).strict(),
  z.object({ type: z.literal("finish-discussion") }).strict(),
  z.object({ type: z.literal("cast-vote"), targetPlayerId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("guess-civilian-word"), guess: z.string().trim().min(1).max(60) }).strict(),
]);
export type UndercoverActionIntent = z.infer<typeof undercoverActionSchema>;

/** Stored JSON was written by this server after engine validation. */
export function restoreState(session: StoredSession): GameState {
  const publicState = session.publicState as PublicState;
  return { public: { ...publicState, clueDeadlineAt: publicState.clueDeadlineAt ?? null }, secret: session.secretState as SecretState, settings: session.settings as GameSettings };
}

function requireSeat(state: GameState, userId: string) {
  if (!state.public.players.some((player) => player.id === userId)) throw new OnlineGameError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
}

/** Binds a browser intent to the server-verified acting player. */
export function toGameAction(intent: UndercoverActionIntent, userId: string): GameAction {
  switch (intent.type) {
    case "finish-discussion": return intent;
    case "cast-vote": return { type: intent.type, playerId: userId, targetPlayerId: intent.targetPlayerId };
    case "guess-civilian-word": return { type: intent.type, playerId: userId, guess: intent.guess };
    default: return { type: intent.type, playerId: userId };
  }
}

/** Creates a missing clue deadline or advances an expired clue turn using server time. */
export function advanceClueDeadline(state: GameState, serverNow: number): GameState | null {
  if (state.public.phase !== "clue") return null;
  const deadlineMs = state.public.clueDeadlineAt ? Date.parse(state.public.clueDeadlineAt) : Number.NaN;
  if (!Number.isFinite(deadlineMs)) {
    return { ...state, public: { ...state.public, clueDeadlineAt: new Date(serverNow + CLUE_TURN_DURATION_MS).toISOString() } };
  }
  if (deadlineMs > serverNow) return null;
  const activePlayer = state.public.players.filter((player) => player.alive)[state.public.clueIndex];
  return activePlayer ? undercoverGame.applyAction(state, { type: "submit-clue", playerId: activePlayer.id }, serverNow) : null;
}

export const undercoverOnline: OnlineGameServer = {
  key: undercoverGame.key,
  minPlayers: undercoverGame.minPlayers,
  maxPlayers: undercoverGame.maxPlayers,
  parseSettings(input) {
    const parsed = undercoverRoomSettingsSchema.safeParse(input);
    if (!parsed.success) throw new OnlineGameError(400, "invalid_input", "Pengaturan room tidak valid.");
    try {
      return undercoverGame.validateSettings(parsed.data, undercoverGame.maxPlayers);
    } catch {
      throw new OnlineGameError(400, "invalid_input", "Pengaturan room tidak valid.");
    }
  },
  createRound(members, rawSettings) {
    let settings: GameSettings;
    try {
      settings = undercoverGame.validateSettings(rawSettings, members.length);
    } catch (cause) {
      throw new OnlineGameError(409, "invalid_settings", cause instanceof Error ? cause.message : "Pengaturan tidak sesuai jumlah pemain.");
    }
    const state = undercoverGame.createInitialState(members.map((member) => member.displayName), settings, undefined, members.map((member) => member.userId));
    return { publicState: state.public, secretState: state.secret, playerPrivate: state.secret.assignments };
  },
  applyIntent(session, rawIntent, ctx) {
    const intent = undercoverActionSchema.safeParse(rawIntent);
    if (!intent.success) throw new OnlineGameError(400, "invalid_input", "Aksi permainan tidak valid.");
    const state = restoreState(session);
    requireSeat(state, ctx.userId);
    try {
      return { publicState: undercoverGame.applyAction(state, toGameAction(intent.data, ctx.userId), ctx.now).public };
    } catch {
      throw new OnlineGameError(400, "invalid_action", "Aksi tidak sesuai dengan fase permainan saat ini.");
    }
  },
  // Votes in Undercover are also simultaneous; a stale version should not lose a valid vote.
  retryOnConflict(intent) {
    return typeof intent === "object" && intent !== null && (intent as { type?: unknown }).type === "cast-vote";
  },
  advance(session, now) {
    const next = advanceClueDeadline(restoreState(session), now);
    return next ? { publicState: next.public } : null;
  },
  view(session, { userId }) {
    const state = restoreState(session);
    const view = undercoverGame.getPlayerView(state, userId);
    if (!view) return null;
    return { view, round: state.public.round, hasVoted: Boolean(state.public.votes[userId]), votesSubmitted: Object.keys(state.public.votes).length };
  },
};
