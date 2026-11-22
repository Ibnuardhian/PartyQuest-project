import type { Alignment, ClassicPhase, ClassicRole, WinnerFaction } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import type { buildPlayerView } from "@/games/werewolf/server/view";

/** The JSON a player receives from /api/sessions/[id]/view for Werewolf. */
export type WerewolfView = NonNullable<ReturnType<typeof buildPlayerView>>;
export type WerewolfSnapshot = WerewolfView & {
  sessionId: string;
  roomCode: string;
  stateVersion: number;
  status: string;
  serverNow: number;
  /** Client clock when the snapshot arrived; used to correct countdowns to server time. */
  receivedAt: number;
};

export const PHASE_LABELS: Record<ClassicPhase, string> = {
  ROLE_REVEAL: "Pembagian role",
  NIGHT_INTRO: "Malam tiba",
  NIGHT_TURN: "Fase malam",
  HUNTER_REVENGE: "Tembakan Pemburu",
  DAY_DISCUSSION: "Diskusi siang",
  OPEN_VOTING: "Voting",
  TIE_DEFENSE: "Pembelaan",
  TIE_REVOTE: "Voting ulang",
  GAME_OVER: "Permainan selesai",
};

export const ALIGNMENT_LABELS: Record<Alignment, string> = { VILLAGER: "Kubu Warga", WEREWOLF: "Kubu Werewolf", INDEPENDENT: "Independen" };

export const FACTION_LABELS: Record<WinnerFaction, string> = { VILLAGER: "Warga Desa", WEREWOLF: "Werewolf", TANNER: "Tanner", LOVERS: "Sepasang Kekasih" };

export const roleName = (role: ClassicRole) => CLASSIC_ROLE_INFO[role].name;

export const isNightPhase = (phase: string) => phase === "NIGHT_INTRO" || phase === "NIGHT_TURN";
