import type { GameModule } from "@/games/types";
import type { Category } from "@/games/undercover/contract";
import { UNDERCOVER_ONLINE_SETUP_PATH, UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";
import { UndercoverCatalogCard } from "@/games/undercover/ui/catalog-card";
import { CATEGORY_LABELS } from "@/games/undercover/ui/labels";
import UndercoverOnlineGame from "@/games/undercover/ui/online-game";

/** Undercover's entry point for the platform. Everything Undercover-specific lives in this folder. */
export const undercoverModule: GameModule = {
  key: "undercover",
  title: "Undercover",
  setupHref: UNDERCOVER_SETUP_PATH,
  onlineSetupHref: UNDERCOVER_ONLINE_SETUP_PATH,
  CatalogCard: UndercoverCatalogCard,
  OnlineGame: UndercoverOnlineGame,
  describeRoomSettings(raw) {
    const settings = (raw ?? {}) as { category?: Category; undercoverCount?: number; mrWhiteEnabled?: boolean };
    return [
      { label: "Kategori", value: settings.category ? CATEGORY_LABELS[settings.category] ?? settings.category : "—" },
      { label: "Undercover", value: String(settings.undercoverCount ?? "—") },
      { label: "Mr. White", value: settings.mrWhiteEnabled ? "Aktif" : "Nonaktif" },
    ];
  },
};
