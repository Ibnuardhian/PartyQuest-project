import type { ComponentType } from "react";

/**
 * What a game folder (src/games/<game>/index.ts) exposes to the platform UI.
 * The catalog, lobby, and play route only talk to games through this shape.
 */
export interface GameModule {
  key: string;
  title: string;
  /** Setup page for the game (e.g. /games/<key>). */
  setupHref: string;
  /** Setup page opened in Online Room mode, when the game supports it. */
  onlineSetupHref?: string;
  /** The game's own catalog card, so each game keeps its visual identity. */
  CatalogCard: ComponentType;
  /** In-game screen for Online Room. */
  OnlineGame?: ComponentType<{ roomCode: string; sessionId: string }>;
  /** Human-readable room settings for the lobby. */
  describeRoomSettings?(settings: unknown): Array<{ label: string; value: string }>;
}
