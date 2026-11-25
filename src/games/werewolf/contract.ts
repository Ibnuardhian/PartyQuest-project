/** Werewolf shared types. Rules: docs/02-game-rules-and-rosters.md. */

export const CLASSIC_ROLES = [
  "WEREWOLF", "VILLAGER", "SEER", "DOCTOR", "HUNTER", "MASON", "DISEASE",
  "TANNER", "LYCAN", "CURSED", "WITCH", "CUPID", "MINION", "MAYOR",
  // Phase 8 (docs/02 §2.2): APPRENTICE_SEER is a base role, the rest are twist roles.
  "APPRENTICE_SEER", "PRINCE", "TROUBLEMAKER", "SPELLCASTER", "LONE_WOLF", "VAMPIRE",
  "ALPHA_WOLF", "SORCERER", "WOLF_CUB", "DIRE_WOLF", "DREAM_WOLF",
] as const;
export type ClassicRole = (typeof CLASSIC_ROLES)[number];

export const BASE_ROLES: readonly ClassicRole[] = ["WEREWOLF", "VILLAGER", "SEER", "DOCTOR", "HUNTER", "MASON", "DISEASE", "APPRENTICE_SEER"];
export const TWIST_ROLES: readonly ClassicRole[] = [
  "TANNER", "LYCAN", "CURSED", "WITCH", "CUPID", "MINION", "MAYOR",
  "PRINCE", "TROUBLEMAKER", "SPELLCASTER", "LONE_WOLF", "VAMPIRE", "ALPHA_WOLF", "SORCERER", "WOLF_CUB", "DIRE_WOLF", "DREAM_WOLF",
];

/** Roles that belong to the Werewolf pack: they count as Werewolves for the win check and read as Werewolf to the Seer. */
export const PACK_ROLES: readonly ClassicRole[] = ["WEREWOLF", "ALPHA_WOLF", "WOLF_CUB", "DIRE_WOLF", "DREAM_WOLF", "LONE_WOLF"];
/** Pack members who wake with the pack and take part in the attack (Dream Wolf sleeps). */
export const HUNTING_ROLES: readonly ClassicRole[] = ["WEREWOLF", "ALPHA_WOLF", "WOLF_CUB", "DIRE_WOLF", "LONE_WOLF"];

export type Alignment = "VILLAGER" | "WEREWOLF" | "INDEPENDENT";
export type DeadRevealMode = "SPECTATOR_REVEAL" | "KEEP_HIDDEN";

/** Night priority order (docs/02 §1.2). CUPID and MASON act on night 1 only. */
export const NIGHT_ORDER = ["CUPID", "MASON", "DIRE_WOLF", "WEREWOLF", "SORCERER", "DOCTOR", "SEER", "APPRENTICE_SEER", "SPELLCASTER", "VAMPIRE", "WITCH"] as const;
export type NightRole = (typeof NIGHT_ORDER)[number];
export const FIRST_NIGHT_ONLY: readonly NightRole[] = ["CUPID", "MASON", "DIRE_WOLF"];

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

export type DeathReason = "WEREWOLF" | "POISON" | "HEARTBREAK" | "BOND" | "EXECUTION" | "HUNTER" | "DEAD_AFK";
export type WinnerFaction = "VILLAGER" | "WEREWOLF" | "TANNER" | "LOVERS" | "LONE_WOLF" | "VAMPIRE";

export interface ClassicSettings {
  roles: Partial<Record<ClassicRole, number>>;
  deadRevealMode: DeadRevealMode;
  nightTurnSeconds: number;
  dayDiscussionSeconds: number;
  /** Advanced mode: twist roles (TWIST_ROLES) may be in the game. Off (or absent) means base roles only. */
  advanced?: boolean;
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
  | { type: "AFK_PROMOTION"; night: number; role: NightRole }
  | { type: "PRINCE"; day: number; playerId: string };

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
  resumePhase: "DAY_DISCUSSION" | "NIGHT_INTRO" | "OPEN_VOTING" | null;
  winner: { faction: WinnerFaction; playerIds: string[] } | null;
  winReason: string | null;
  log: LogEntry[];
  /** Spellcaster's target for today's discussion (cannot speak). Cleared when the next night starts. */
  silencedId: string | null;
  /** Players bitten by the Vampire: they are executed after the next vote. Public, like a dawn announcement. */
  doomedIds: string[];
  /** Princes whose identity was revealed by surviving an execution. */
  revealedPrinceIds: string[];
  /** The Troublemaker called a second vote for today (played after the first execution). */
  secondVoteQueued: boolean;
}

export interface NightActions {
  wolfTargets: Record<string, string | null>;
  doctorTarget: string | null;
  seerTarget: string | null;
  witchHeal: boolean;
  witchPoisonTarget: string | null;
  cupidLink: [string, string] | null;
  /** Second victim picks of the pack, only used on the night after a Wolf Cub died (attack quota 2). */
  wolfSecondTargets: Record<string, string | null>;
  /** The Alpha Wolf asked to convert tonight's victim instead of killing them. */
  alphaConvert: boolean;
  sorcererTarget: string | null;
  silenceTarget: string | null;
  biteTarget: string | null;
  direTarget: string | null;
  /** Players who took their action this turn (AFK detection). */
  actedPlayerIds: string[];
}

export interface SeerResult { seerId: string; night: number; targetId: string; appearsAs: "WEREWOLF" | "VILLAGER" }
export interface SorcererResult { sorcererId: string; night: number; targetId: string; isSeer: boolean }

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
  sorcererResults: SorcererResult[];
  /** Dire Wolf and the partner it picked on night 1; the Dire Wolf dies with the partner. */
  direBond: { direId: string; partnerId: string } | null;
  /** The Alpha Wolf's one conversion has been spent. */
  alphaUsed: boolean;
  /** Night number on which the pack may pick two victims (the night after a Wolf Cub died). */
  doubleAttackNight: number | null;
  /** The Troublemaker's once-per-game second vote has been spent. */
  troublemakerUsed: boolean;
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
export type NightActionType = "DOCTOR_PROTECT" | "SEER_INSPECT" | "WITCH_HEAL" | "WITCH_POISON" | "CUPID_LINK" | "SORCERER_INSPECT" | "SPELLCASTER_SILENCE" | "VAMPIRE_BITE" | "DIRE_PARTNER" | "SKIP";

export type ClassicAction =
  | { type: "ready" }
  | { type: "wolf-target"; targetId: string | null; /** Second victim, only on the night after a Wolf Cub died. */ secondTargetId?: string | null; /** Alpha Wolf: convert the victim instead of killing (once per game). */ convert?: boolean }
  | { type: "night-action"; actionType: NightActionType; targetId?: string; secondaryTargetId?: string }
  | { type: "skip-discussion" }
  | { type: "vote"; targetId: string | null }
  | { type: "hunter-shot"; targetId: string }
  /** Troublemaker: once per game, during voting, call a second vote after this execution. */
  | { type: "second-vote" }
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
