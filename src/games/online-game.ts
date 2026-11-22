/**
 * Contract between the platform Online Room API and a game folder (src/games/<game>/server).
 * The platform owns guests, rooms, membership, versioning, and persistence;
 * the game owns settings, rules, action validation, and per-player views.
 * State arrives as stored JSON written only by the server.
 */

export interface RoundMember { userId: string; displayName: string }
export interface NewRound { publicState: { phase: string; players: Array<{ id: string; alive: boolean }> }; secretState: unknown; playerPrivate: Array<{ playerId: string }> }
export interface StoredSession { publicState: unknown; secretState: unknown; settings: unknown }

export class OnlineGameError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export interface OnlineGameServer {
  key: string;
  minPlayers: number;
  maxPlayers: number;
  /** Validates room settings at creation time. Throws OnlineGameError when invalid. */
  parseSettings(input: unknown): unknown;
  /** Deals a new round for the verified active members. */
  createRound(members: RoundMember[], settings: unknown): NewRound;
  /** Applies a browser intent for the verified user; returns the next public state. */
  applyIntent(session: StoredSession, userId: string, intent: unknown, now: number): NewRound["publicState"];
  /** Server-time housekeeping (e.g. expired turn deadlines); null when nothing changes. */
  advance(session: StoredSession, now: number): NewRound["publicState"] | null;
  /** The view authorized for one player, or null when they hold no seat. */
  view(session: StoredSession, userId: string): Record<string, unknown> | null;
}
