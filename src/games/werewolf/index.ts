import type { GameModule } from "@/games/types";
import { CLASSIC_ROLES, type ClassicRole } from "@/games/werewolf/contract";
import { WEREWOLF_SETUP_PATH } from "@/games/werewolf/paths";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { WerewolfCatalogCard } from "@/games/werewolf/ui/catalog-card";
import WerewolfOnlineGame from "@/games/werewolf/ui/online-game";
import { WerewolfRoomSettingsEditor } from "@/games/werewolf/ui/room-settings-editor";

/** Werewolf's entry point for the platform. Everything Werewolf-specific lives in this folder. */
export const werewolfModule: GameModule = {
  key: "werewolf",
  title: "Werewolf",
  setupHref: WEREWOLF_SETUP_PATH,
  CatalogCard: WerewolfCatalogCard,
  OnlineGame: WerewolfOnlineGame,
  RoomSettingsEditor: WerewolfRoomSettingsEditor,
  describeRoomSettings(raw) {
    const settings = (raw ?? {}) as { roles?: "AUTO" | Partial<Record<ClassicRole, number>>; deadRevealMode?: string; nightTurnSeconds?: number; dayDiscussionSeconds?: number };
    const roles = settings.roles;
    const composition = !roles || roles === "AUTO" ? "Otomatis" : CLASSIC_ROLES.filter((role) => (roles[role] ?? 0) > 0).map((role) => `${CLASSIC_ROLE_INFO[role].name} ${roles[role]}`).join(", ");
    return [
      { label: "Komposisi", value: composition },
      { label: "Tereliminasi", value: settings.deadRevealMode === "SPECTATOR_REVEAL" ? "Lihat semua role" : "Role rahasia" },
      { label: "Giliran malam", value: `${settings.nightTurnSeconds ?? 15} detik` },
      { label: "Diskusi", value: `${Math.round((settings.dayDiscussionSeconds ?? 180) / 60)} menit` },
    ];
  },
};
