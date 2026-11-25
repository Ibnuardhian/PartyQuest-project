import type { GameModule } from "@/games/types";
import { DEFAULT_CLUE_SECONDS, formatClueSeconds, type Category } from "@/games/undercover/contract";
import { UNDERCOVER_ONLINE_SETUP_PATH, UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";
import { UndercoverCatalogCard } from "@/games/undercover/ui/catalog-card";
import { CATEGORY_LABELS } from "@/games/undercover/ui/labels";
import UndercoverOnlineGame from "@/games/undercover/ui/online-game";
import { UndercoverRoomSettingsEditor } from "@/games/undercover/ui/room-settings-editor";

/** Undercover's entry point for the platform. Everything Undercover-specific lives in this folder. */
export const undercoverModule: GameModule = {
  key: "undercover",
  title: "Undercover",
  setupHref: UNDERCOVER_SETUP_PATH,
  themeClass: "undercover-theme",
  onlineSetupHref: UNDERCOVER_ONLINE_SETUP_PATH,
  CatalogCard: UndercoverCatalogCard,
  OnlineGame: UndercoverOnlineGame,
  RoomSettingsEditor: UndercoverRoomSettingsEditor,
  describeRoomSettings(raw) {
    const settings = (raw ?? {}) as { category?: Category; undercoverCount?: number; mrWhiteEnabled?: boolean; clueSeconds?: number };
    return [
      { label: "Kategori", value: settings.category ? CATEGORY_LABELS[settings.category] ?? settings.category : "—" },
      { label: "Undercover", value: String(settings.undercoverCount ?? "—") },
      { label: "Mr. White", value: settings.mrWhiteEnabled ? "Aktif" : "Nonaktif" },
      { label: "Waktu clue per pemain", value: formatClueSeconds(settings.clueSeconds ?? DEFAULT_CLUE_SECONDS) },
      { label: "Putaran clue", value: "2 sebelum voting pertama, lalu 1" },
    ];
  },
};
