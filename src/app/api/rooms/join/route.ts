import { z } from "zod";
import { apiError, apiSuccess, mapDatabaseError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastRoomChanged } from "@/lib/supabase/realtime";

const joinSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/), displayName: z.string().trim().min(1).max(24) }).strict();

export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const body = joinSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Kode room atau nama pemain tidak valid.");
  try {
    const { data, error } = await createAdminClient().rpc("join_room", { p_user_id: guest.userId, p_code: body.data.code, p_display_name: body.data.displayName });
    if (error) {
      const mapped = mapDatabaseError(error.message);
      return apiError(mapped.status, mapped.code, mapped.message);
    }
    await broadcastRoomChanged(data.id, Date.now());
    return apiSuccess({ code: data.code, roomId: data.id });
  } catch {
    return apiError(503, "supabase_unavailable", "Room belum dapat diakses. Periksa konfigurasi Supabase.");
  }
}
