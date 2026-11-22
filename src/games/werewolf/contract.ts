/** Werewolf shared types. Rules: docs/02-game-rules-and-rosters.md. */

export const CLASSIC_ROLES = [
  "WEREWOLF", "VILLAGER", "SEER", "DOCTOR", "HUNTER", "MASON", "DISEASE",
  "TANNER", "LYCAN", "CURSED", "WITCH", "CUPID", "MINION", "MAYOR",
] as const;
export type ClassicRole = (typeof CLASSIC_ROLES)[number];

export const BASE_ROLES: readonly ClassicRole[] = ["WEREWOLF", "VILLAGER", "SEER", "DOCTOR", "HUNTER", "MASON", "DISEASE"];
export const TWIST_ROLES: readonly ClassicRole[] = ["TANNER", "LYCAN", "CURSED", "WITCH", "CUPID", "MINION", "MAYOR"];

export type Alignment = "VILLAGER" | "WEREWOLF" | "INDEPENDENT";
export type DeadRevealMode = "SPECTATOR_REVEAL" | "KEEP_HIDDEN";

/** Night priority order (docs/02 §1.2). CUPID and MASON act on night 1 only. */
export const NIGHT_ORDER = ["CUPID", "MASON", "WEREWOLF", "DOCTOR", "SEER", "WITCH"] as const;
export type NightRole = (typeof NIGHT_ORDER)[number];
export const FIRST_NIGHT_ONLY: readonly NightRole[] = ["CUPID", "MASON"];

export type ClassicPhase =
  | "ROLE_REVEAL"
  | "NIGHT_INTRO"
  | "NIGHT_TURN"
  | "HUNTER_REVENGE"
  | "DAY_DISCUSSION"
  | "OPEN_VOTING"
  | "TIE_DEFENSE"
  | "TIE_REVOTE"
  | "GAME_OVER";

export type DeathReason = "WEREWOLF" | "POISON" | "HEARTBREAK" | "EXECUTION" | "HUNTER" | "DEAD_AFK";
export type WinnerFaction = "VILLAGER" | "WEREWOLF" | "TANNER" | "LOVERS";

export interface ClassicSettings {
  roles: Partial<Record<ClassicRole, number>>;
  deadRevealMode: DeadRevealMode;
  nightTurnSeconds: number;
  dayDiscussionSeconds: number;
}

export const CLASSIC_MIN_PLAYERS = 5;
export const CLASSIC_MAX_PLAYERS = 16;

/** Fixed durations (seconds) from docs/02 where the spec names them. */
export const PHASE_SECONDS = {
  nightIntro: 6,
  voting: 60,
  tieDefense: 30,
  tieRevote: 20,
  hunterRevenge: 15,
} as const;

export interface ClassicPlayer {
  id: string;
  name: string;
  alive: boolean;
  deathReason: DeathReason | null;
  /** False for one voting round after an AFK strike. */
  canVote: boolean;
  /** Strike 1 set by `Paksa Lanjut`; cleared once the resulting vote ban has been served. */
  hasAfkPenalty: boolean;
}

export interface VoteRecord { voterId: string; targetId: string | null; weight: number }

export type LogEntry =
  | { type: "DAWN"; night: number; deaths: Array<{ playerId: string; reason: DeathReason }>; diseaseBlocked: boolean }
  | { type: "EXECUTION"; day: number; playerId: string | null; votes: VoteRecord[] }
  | { type: "HUNTER"; hunterId: string; targetId: string | null; deaths: Array<{ playerId: string; reason: DeathReason }> }
  | { type: "AFK_ELIM"; playerId: string; deaths: Array<{ playerId: string; reason: DeathReason }> }
  | { type: "AFK_PROMOTION"; night: number; role: NightRole };

/** Everything here is safe for every player to see. */
export interface ClassicPublicState {
  phase: ClassicPhase;
  nightNumber: number;
  dayNumber: number;
  phaseDeadlineAt: string | null;
  /** Night turns for the current night, in priority order. Fixed even when holders are dead. */
  nightQueue: NightRole[];
  nightTurnIndex: number;
  players: ClassicPlayer[];
  readyPlayerIds: string[];
  skipDiscussionIds: string[];
  /** Who has voted in the current voting phase, never for whom. */
  votedPlayerIds: string[];
  tiedPlayerIds: string[];
  /** Most recent simultaneous reveal (voter -> target). */
  lastVoteReveal: VoteRecord[] | null;
  /** Hunters waiting to shoot, and where play resumes afterwards. */
  hunterQueue: string[];
  resumePhase: "DAY_DISCUSSION" | "NIGHT_INTRO" | null;
  winner: { faction: WinnerFaction; playerIds: string[] } | null;
  winReason: string | null;
  log: LogEntry[];
}

export interface NightActions {
  wolfTargets: Record<string, string | null>;
  doctorTarget: string | null;
  seerTarget: string | null;
  witchHeal: boolean;
  witchPoisonTarget: string | null;
  cupidLink: [string, string] | null;
  /** Players who took their action this turn (AFK detection). */
  actedPlayerIds: string[];
}

export interface SeerResult { seerId: string; night: number; targetId: string; appearsAs: "WEREWOLF" | "VILLAGER" }

/** Server-only. Never sent whole to a client. */
export interface ClassicSecretState {
  roles: Record<string, ClassicRole>;
  originalRoles: Record<string, ClassicRole>;
  lovers: [string, string] | null;
  doctorLastTarget: string | null;
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  /** Werewolves ate the Disease; their next night's kill is blocked. */
  werewolvesDiseased: boolean;
  night: NightActions;
  seerResults: SeerResult[];
  votes: Record<string, string | null>;
  /** Private notices, e.g. AFK promotion or Cursed conversion. */
  notices: Array<{ playerId: string; message: string }>;
}

export interface ClassicGameState {
  public: ClassicPublicState;
  secret: ClassicSecretState;
  settings: ClassicSettings;
}

/** SKIP lets the active role pass deliberately (e.g. a Witch keeping her potions) without counting as AFK. */
export type NightActionType = "DOCTOR_PROTECT" | "SEER_INSPECT" | "WITCH_HEAL" | "WITCH_POISON" | "CUPID_LINK" | "SKIP";

export type ClassicAction =
  | { type: "ready" }
  | { type: "wolf-target"; targetId: string | null }
  | { type: "night-action"; actionType: NightActionType; targetId?: string; secondaryTargetId?: string }
  | { type: "skip-discussion" }
  | { type: "vote"; targetId: string | null }
  | { type: "hunter-shot"; targetId: string }
  | { type: "force-advance" };

export interface Actor { playerId: string; isHost: boolean }

export interface ClassicContext {
  now: number;
  /** Uniform [0, 1). Injected for deterministic tests. */
  random?: () => number;
  /** Players currently connected; used for AFK promotion eligibility. */
  onlinePlayerIds?: readonly string[];
}

// ---------- Mode 2: ONUW ----------

export const ONUW_ROLES = ["WEREWOLF", "MINION", "MASON", "SEER", "ROBBER", "TROUBLEMAKER", "DRUNK", "INSOMNIAC", "TANNER", "HUNTER", "VILLAGER"] as const;
export type OnuwRole = (typeof ONUW_ROLES)[number];
export const ONUW_MIN_PLAYERS = 3;
export const ONUW_MAX_PLAYERS = 10;
