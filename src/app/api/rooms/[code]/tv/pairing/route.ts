import { apiError, apiSuccess, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode } from "@/lib/rooms/repository";
import { createPairing } from "@/lib/rooms/tv";

export const runtime = "nodejs";

/** Host creates a short-lived pairing code for a shared TV screen. */
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (room.host_user_id !== guest.userId) return apiError(403, "host_required", "Hanya host yang dapat menghubungkan TV.");
    return apiSuccess(await createPairing(room.id));
  } catch {
    return apiError(503, "tv_unavailable", "Kode TV belum dapat dibuat.");
  }
}
