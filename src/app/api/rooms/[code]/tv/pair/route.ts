import { cookies } from "next/headers";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode } from "@/lib/rooms/repository";
import { pairTvScreen, TV_COOKIE_NAME } from "@/lib/rooms/tv";

export const runtime = "nodejs";

const bodySchema = z.object({ pairingCode: z.string().regex(/^[0-9]{6}$/) }).strict();

/** A TV trades the host's pairing code for a read-only token (HttpOnly cookie). No guest session needed. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Kode TV harus 6 angka.");
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    const token = await pairTvScreen(room.id, body.data.pairingCode);
    if (!token) return apiError(403, "pairing_invalid", "Kode TV salah atau sudah kedaluwarsa. Minta host membuat kode baru.");
    (await cookies()).set(TV_COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
    return apiSuccess({ paired: true, code: room.code });
  } catch {
    return apiError(503, "tv_unavailable", "TV belum dapat dihubungkan.");
  }
}
