import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { undercoverGame } from "@/games/undercover/engine";
import { generateRoomCode } from "@/lib/room-code";
import { createAdminClient } from "@/lib/supabase/admin";

const createRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(24),
  settings: z.object({
    category: z.enum(["makanan", "hewan", "benda", "tempat", "pekerjaan", "campuran"]),
    undercoverCount: z.number().int().min(1).max(4),
    mrWhiteEnabled: z.boolean(),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const body = createRoomSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Nama atau pengaturan room tidak valid.");
  try {
    undercoverGame.validateSettings(body.data.settings, 12);
    const admin = createAdminClient();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await admin.rpc("create_room", {
        p_host_user_id: guest.userId,
        p_code: generateRoomCode(),
        p_display_name: body.data.displayName,
        p_settings: body.data.settings,
      });
      if (!error && data) return apiSuccess({ code: data.code, roomId: data.id }, 201);
      if (error?.message.includes("game_rooms_code_key") && attempt < 4) continue;
      if (error) {
        const mapped = error.message.includes("rate_limited") ? { code: "rate_limited", status: 429, message: "Terlalu banyak membuat room. Coba lagi sebentar." } : null;
        if (mapped) return apiError(mapped.status, mapped.code, mapped.message);
      }
      break;
    }
    return apiError(503, "room_unavailable", "Room belum dapat dibuat. Coba lagi sebentar.");
  } catch {
    return apiError(503, "supabase_unavailable", "Online Room memerlukan konfigurasi Supabase yang valid.");
  }
}
