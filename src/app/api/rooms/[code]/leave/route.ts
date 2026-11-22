import { apiError, apiSuccess, mapDatabaseError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastRoomChanged } from "@/lib/supabase/realtime";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const { code } = await params;
  try {
    const admin = createAdminClient();
    const { data: room } = await admin.from("game_rooms").select("id").eq("code", code.toUpperCase()).maybeSingle();
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    const { error } = await admin.rpc("leave_room", { p_room_id: room.id, p_user_id: guest.userId });
    if (error) {
      const mapped = mapDatabaseError(error.message);
      return apiError(mapped.status, mapped.code, mapped.message);
    }
    await broadcastRoomChanged(room.id, Date.now());
    return apiSuccess({ left: true });
  } catch {
    return apiError(503, "room_unavailable", "Kamu belum dapat keluar dari room.");
  }
}
