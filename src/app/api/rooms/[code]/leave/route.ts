import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, leaveRoom } from "@/lib/rooms/repository";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    await leaveRoom(room.id, guest.userId);
    return apiSuccess({ left: true });
  } catch (error) {
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Kamu belum dapat keluar dari room." });
  }
}
