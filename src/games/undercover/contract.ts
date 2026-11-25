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
/** Spoken-clue time per player is a room setting: the host picks one of these fixed choices (max 3 minutes). */
export const CLUE_SECONDS_OPTIONS = [30, 60, 90, 120, 150, 180] as const;
export const DEFAULT_CLUE_SECONDS = CLUE_TURN_DURATION_MS / 1000;
/** Default pre-selected for new Online Rooms (the engine itself falls back to the 3 minute maximum). */
export const SUGGESTED_CLUE_SECONDS = 60;

export function isClueSecondsOption(value: unknown): value is (typeof CLUE_SECONDS_OPTIONS)[number] {
  return typeof value === "number" && (CLUE_SECONDS_OPTIONS as readonly number[]).includes(value);
}

/** "30 detik", "1 menit", "1 menit 30 detik", "3 menit". */
export function formatClueSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} detik`;
  return rest === 0 ? `${minutes} menit` : `${minutes} menit ${rest} detik`;
}
/** Clue turns each living player gets before a vote: two before the first vote, one after every vote without a winner. */
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
  /** Seconds each player has for a spoken clue (Online Room). Absent means the default. */
  clueSeconds?: number;
}

export interface PublicState {
  phase: GamePhase;
  players: Player[];
  round: number;
  revealIndex: number;
  revealedPlayerIds: string[];
  clueIndex: number;
  clueDeadlineAt: string | null;
  /** Seconds per clue turn, copied from the room settings so every player's screen can show it. */
  clueSeconds?: number;
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
  | { type: "submit-clue"; playerId: string }
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

/** How many clue passes (one clue from each living player) the given round has before voting. */
export function cluePassesForRound(round: number): number {
  return round <= 1 ? CLUE_PASSES_FIRST_ROUND : CLUE_PASSES_LATER_ROUNDS;
}

/** Total clue turns in a round; `clueIndex` counts them from 0. */
export function clueTurnsForRound(round: number, livingCount: number): number {
  return livingCount * cluePassesForRound(round);
}

/** The player whose clue turn it is: players speak in seat order and start over for each extra pass. */
export function currentCluePlayer(state: Pick<PublicState, "players" | "clueIndex">): Player | undefined {
  const living = state.players.filter((player) => player.alive);
  return living.length > 0 ? living[state.clueIndex % living.length] : undefined;
}

/** 1-based pass the given clue turn belongs to. */
export function cluePassOfTurn(clueIndex: number, livingCount: number): number {
  return livingCount > 0 ? Math.floor(clueIndex / livingCount) + 1 : 1;
}
