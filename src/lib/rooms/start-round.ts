import "server-only";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { OnlineGameError } from "@/games/online-game";
import { getOnlineGame } from "@/games/online-registry";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, listActiveMembers, listUnreadyNewcomers, startRound } from "@/lib/rooms/repository";

/** Shared by start and rematch: host check, member checks, game deals the round, DB re-validates atomically. */
export async function handleStartRound(kind: "start" | "rematch", rawCode: string) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const code = normalizeRoomCode(rawCode);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  const failure = { status: 503, code: "game_unavailable", message: kind === "start" ? "Permainan belum dapat dimulai." : "Rematch belum dapat dimulai." };
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (room.host_user_id !== guest.userId) return apiError(403, "host_required", "Hanya host yang dapat melakukan aksi ini.");
    const game = getOnlineGame(room.game_key);
    if (!game) return apiError(409, "unknown_game", "Game room ini tidak tersedia.");
    const members = await listActiveMembers(room.id);
    if (members.length < game.minPlayers || members.length > game.maxPlayers) return apiError(409, "invalid_player_count", `Permainan memerlukan ${game.minPlayers}–${game.maxPlayers} pemain aktif.`);
    if (new Set(members.map((member) => member.display_name.trim().toLocaleLowerCase("id-ID"))).size !== members.length) return apiError(409, "duplicate_name", "Nama pemain di room harus berbeda.");
    if (kind === "start" && members.some((member) => !member.is_ready)) return apiError(409, "players_not_ready", "Semua pemain harus siap sebelum mulai.");
    if (kind === "rematch" && (await listUnreadyNewcomers(room.id)).length > 0) return apiError(409, "players_not_ready", "Pemain baru harus menandai siap sebelum main ulang.");
    const round = game.createRound(members.map((member) => ({ userId: member.user_id, displayName: member.display_name })), room.settings);
    const session = await startRound(kind, room.id, guest.userId, round);
    if (!session) return apiError(failure.status, failure.code, failure.message);
    return apiSuccess({ sessionId: session.id, stateVersion: session.state_version }, 201);
  } catch (error) {
    if (error instanceof OnlineGameError) return apiError(error.status, error.code, error.message);
    return databaseErrorResponse(error, failure);
  }
}
