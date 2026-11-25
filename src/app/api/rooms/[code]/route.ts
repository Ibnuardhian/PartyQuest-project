import { apiError, apiSuccess, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { normalizeRoomCode } from "@/lib/room-code";
import { getOnlineGame } from "@/games/online-registry";
import { findLatestSession, listFinishedSessions, findRoomByCode, isActiveMember, listActiveMembers, touchMember } from "@/lib/rooms/repository";
import { isTvConnected } from "@/lib/rooms/tv";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (room.expires_at.getTime() <= Date.now()) return apiError(410, "room_expired", "Room ini sudah kedaluwarsa.");
    if (!(await isActiveMember(room.id, guest.userId))) return apiError(403, "not_a_member", "Gabung ke room ini untuk melihat lobi.", { gameKey: room.game_key });
    await touchMember(room.id, guest.userId);
    const [members, session, tvConnected] = await Promise.all([listActiveMembers(room.id), findLatestSession(room.id), isTvConnected(room.id)]);
    const scores: Record<string, number> = {};
    const game = getOnlineGame(room.game_key);
    if (game?.roundPoints) {
      for (const finished of await listFinishedSessions(room.id)) {
        const points = game.roundPoints({ publicState: finished.public_state, secretState: finished.private_state, settings: finished.settings });
        for (const [userId, value] of Object.entries(points ?? {})) scores[userId] = (scores[userId] ?? 0) + value;
      }
    }
    return apiSuccess({
      room: { id: room.id, code: room.code, gameKey: room.game_key, status: room.status, settings: room.settings, expiresAt: room.expires_at.toISOString(), maxPlayers: room.max_players },
      members,
      scores: game?.roundPoints ? scores : null,
      session,
      tvConnected,
      currentUserId: guest.userId,
      hostUserId: room.host_user_id,
      isHost: room.host_user_id === guest.userId,
    });
  } catch {
    return apiError(503, "room_unavailable", "Room belum dapat dimuat.");
  }
}
