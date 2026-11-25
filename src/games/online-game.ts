/**
 * Contract between the platform Online Room API and a game folder (src/games/<game>/server).
 * The platform owns guests, rooms, membership, presence, versioning, and persistence;
 * the game owns settings, rules, action validation, and per-player views.
 * State arrives as stored JSON written only by the server.
 */

export interface RoundMember { userId: string; displayName: string }
export interface NewRound { publicState: { phase: string; players: Array<{ id: string; alive: boolean }> }; secretState: unknown; playerPrivate: Array<{ playerId: string }> }
export interface StoredSession { publicState: unknown; secretState: unknown; settings: unknown }

/** Who is acting, verified by the platform from the guest cookie and room row. */
export interface Viewer { userId: string; isHost: boolean }

export interface ActionContext extends Viewer {
  now: number;
  /** Active members seen recently (presence heartbeat). */
  onlineUserIds: readonly string[];
}

export class OnlineGameError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export interface OnlineGameServer {
  key: string;
  minPlayers: number;
  maxPlayers: number;
  /** Validates room settings at creation or lobby edit time. Throws OnlineGameError when invalid. */
  parseSettings(input: unknown): unknown;
  /** Default settings for a new room when the client sends none. */
  defaultSettings?(): unknown;
  /** The host may rename members in the lobby (stops a guest from passing as another player). Opt-in per game. */
  hostCanRenameMembers?: boolean;
  /** Deals a new round for the verified active members. */
  createRound(members: RoundMember[], settings: unknown): NewRound;
  /** Applies a browser intent for the verified actor; returns the next public state and, if changed, secret state. */
  applyIntent(session: StoredSession, intent: unknown, ctx: ActionContext): { publicState: NewRound["publicState"]; secretState?: unknown };
  /**
   * True for commutative intents (e.g. simultaneous votes). The platform then re-applies the intent
   * on the latest state after a version conflict instead of rejecting it.
   */
  retryOnConflict?(intent: unknown): boolean;
  /** Server-time housekeeping (e.g. expired deadlines); null when nothing changes. */
  advance(session: StoredSession, now: number): { publicState: NewRound["publicState"]; secretState?: unknown } | null;
  /** The view authorized for one player, or null when they hold no seat. */
  view(session: StoredSession, viewer: Viewer): Record<string, unknown> | null;
  /**
   * Points each player earned in one finished round, keyed by user id; null when the game keeps no score.
   * The platform sums these over the room's finished rounds for the lobby scoreboard.
   */
  roundPoints?(session: StoredSession): Record<string, number> | null;
  /** Read-only public view for a shared screen. */
  publicView?(session: StoredSession): Record<string, unknown>;
}
