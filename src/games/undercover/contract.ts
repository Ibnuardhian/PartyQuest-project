export const GAME_PHASES = [
  "reveal",
  "clue",
  "discussion",
  "voting",
  "revote",
  "mr-white-guess",
  "finished",
] as const;
export const CLUE_TURN_DURATION_MS = 180_000;
/** The clue window is a room setting: the host picks one of these lengths (in minutes). */
export const CLUE_MINUTES_OPTIONS = [1, 3, 5] as const;
export const DEFAULT_CLUE_MINUTES = CLUE_TURN_DURATION_MS / 60_000;

export function isClueMinutesOption(value: unknown): value is (typeof CLUE_MINUTES_OPTIONS)[number] {
  return typeof value === "number" && (CLUE_MINUTES_OPTIONS as readonly number[]).includes(value);
}

export function formatClueMinutes(minutes: number): string {
  return `${minutes} menit`;
}
/** Timed clue windows (putaran) before a vote: two before the first vote, one after every vote without a winner. */
export const CLUE_PASSES_FIRST_ROUND = 2;
export const CLUE_PASSES_LATER_ROUNDS = 1;

export type GamePhase = (typeof GAME_PHASES)[number];
export type Role = "civilian" | "undercover" | "mr-white";
export type Category = "makanan" | "hewan" | "benda" | "tempat" | "pekerjaan" | "campuran";
export type Winner = "civilian" | "undercover" | "mr-white";

export interface Player {
  id: string;
  name: string;
  alive: boolean;
}

export interface GameSettings {
  category: Category;
  undercoverCount: number;
  mrWhiteEnabled: boolean;
  /** Length in minutes of each timed clue window (Online Room, Pass-and-Play round timer). Absent means the default. */
  clueMinutes?: number;
}

export interface PublicState {
  phase: GamePhase;
  players: Player[];
  round: number;
  revealIndex: number;
  revealedPlayerIds: string[];
  /** Clue windows already finished in the current round (0-based index of the running window). */
  clueIndex: number;
  clueDeadlineAt: string | null;
  /** Window length, copied from the room settings so every player's screen can show it. */
  clueMinutes?: number;
  clues: Array<{ playerId: string }>;
  votes: Record<string, string>;
  tiedPlayerIds: string[];
  revoteUsed: boolean;
  eliminatedPlayerId: string | null;
  winner: Winner | null;
  resultReason: string | null;
  lastRoundTied: boolean;
}

export interface PrivatePlayerState {
  playerId: string;
  role: Role;
  word: string | null;
}

/** What a player may see of their own card while the game runs: the word only, never the role. */
export interface PrivateCardView {
  playerId: string;
  word: string | null;
}

export interface SecretState {
  civilianWord: string;
  undercoverWord: string;
  assignments: PrivatePlayerState[];
}

export interface GameState {
  public: PublicState;
  secret: SecretState;
  settings: GameSettings;
}

export type GameAction =
  | { type: "confirm-reveal"; playerId: string }
  | { type: "finish-discussion" }
  | { type: "cast-vote"; playerId: string; targetPlayerId: string }
  | { type: "guess-civilian-word"; playerId: string; guess: string };

export type ValidationResult = { valid: true } | { valid: false; error: string };

export interface PlayerView {
  public: PublicState;
  private: PrivateCardView | null;
  result: { winner: Winner; reason: string; civilianWord: string; undercoverWord: string; assignments: PrivatePlayerState[] } | null;
}

export interface GameDefinition {
  key: string;
  minPlayers: number;
  maxPlayers: number;
  validateSettings(input: unknown, playerCount: number): GameSettings;
  createInitialState(names: string[], settings: GameSettings, randomIndex?: (max: number) => number, playerIds?: string[]): GameState;
  validateAction(state: GameState, action: GameAction): ValidationResult;
  applyAction(state: GameState, action: GameAction, now?: number): GameState;
  getPlayerView(state: GameState, playerId: string): PlayerView | null;
  getResult(state: GameState): PlayerView["result"];
}

/** How many timed clue windows (one clue from everyone, in any order) the given round has before voting. */
export function cluePassesForRound(round: number): number {
  return round <= 1 ? CLUE_PASSES_FIRST_ROUND : CLUE_PASSES_LATER_ROUNDS;
}
