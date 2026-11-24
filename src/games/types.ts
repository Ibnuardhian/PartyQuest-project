import type { ComponentType } from "react";

/**
 * What a game folder (src/games/<game>/index.ts) exposes to the platform UI.
 * The catalog, lobby, and play route only talk to games through this shape.
 */
export interface RoomSettingsEditorProps {
  settings: unknown;
  playerCount: number;
  disabled: boolean;
  onSave(settings: unknown): Promise<void>;
}

export interface GameModule {
  key: string;
  title: string;
  /** Setup page for the game (e.g. /games/<key>). */
  setupHref: string;
  /** CSS class for the game's visual theme; the platform lobby applies it so the lobby matches the catalog card. */
  themeClass?: string;
  /** Setup page opened in Online Room mode, when the game supports it. */
  onlineSetupHref?: string;
  /** The game's own catalog card, so each game keeps its visual identity. */
  CatalogCard: ComponentType;
  /** In-game screen for Online Room. */
  OnlineGame?: ComponentType<{ roomCode: string; sessionId: string }>;
  /** Page a TV/laptop opens to pair as a shared screen (lobby shows a pairing code to the host). */
  tvSetupHref?: string;
  /** Host-only lobby editor for room settings; saved through PATCH /api/rooms/[code]/settings. */
  RoomSettingsEditor?: ComponentType<RoomSettingsEditorProps>;
  /** Human-readable room settings for the lobby. */
  describeRoomSettings?(settings: unknown): Array<{ label: string; value: string }>;
}
