import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { createAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();

export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const body = profileSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Nama tampilan harus 1–24 karakter.");
  try {
    const { error } = await createAdminClient().from("guest_profiles").upsert({ user_id: guest.userId, display_name: body.data.displayName });
    if (error) throw error;
    return apiSuccess({ displayName: body.data.displayName });
  } catch {
    return apiError(503, "profile_unavailable", "Profil tamu belum dapat disimpan. Periksa konfigurasi Supabase.");
  }
}
