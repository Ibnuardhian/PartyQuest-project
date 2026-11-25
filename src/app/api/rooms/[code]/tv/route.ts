import { cookies } from "next/headers";
import { apiError, apiSuccess } from "@/lib/api";
import { getOnlineGame } from "@/games/online-registry";
import { normalizeRoomCode } from "@/lib/room-code";
import { findLatestSession, findRoomByCode, findSession, findSessionSecret, listActiveMembers } from "@/lib/rooms/repository";
import { TV_COOKIE_NAME, tvShowsLastRound, verifyTvToken } from "@/lib/rooms/tv";

export const runtime = "nodejs";

/**
 * Read-only stage data for a paired TV: room status, member list, and the game's public view.
 * Never includes roles, words, night picks, or hidden votes. Each request refreshes TV presence.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (!(await verifyTvToken((await cookies()).get(TV_COOKIE_NAME)?.value, room.id))) return apiError(403, "tv_not_paired", "TV belum dihubungkan ke room ini.");
    const [members, latest] = await Promise.all([listActiveMembers(room.id), findLatestSession(room.id)]);
    let session: { sessionId: string; stateVersion: number; status: string; view: Record<string, unknown> } | null = null;
    const game = getOnlineGame(room.game_key);
    if (latest && game?.publicView && tvShowsLastRound(room.status)) {
      const [full, secretState] = await Promise.all([findSession(latest.id), findSessionSecret(latest.id)]);
      if (full && secretState !== null) {
        session = { sessionId: full.id, stateVersion: full.state_version, status: full.status, view: game.publicView({ publicState: full.public_state, secretState, settings: room.settings }) };
      }
    }
    return apiSuccess({
      room: { code: room.code, status: room.status, gameKey: room.game_key },
      members: members.map((member) => ({ name: member.display_name, online: member.online, ready: member.is_ready })),
      session,
      serverNow: Date.now(),
    });
  } catch {
    return apiError(503, "tv_unavailable", "Data TV belum dapat dimuat.");
  }
}
