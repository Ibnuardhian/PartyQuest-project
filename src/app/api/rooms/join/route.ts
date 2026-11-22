import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { ROOM_CODE_PATTERN } from "@/lib/room-code";
import { joinRoom, touchMember } from "@/lib/rooms/repository";

export const runtime = "nodejs";

const joinSchema = z.object({ code: z.string().trim().toUpperCase().regex(ROOM_CODE_PATTERN), displayName: z.string().trim().min(1).max(24) }).strict();

export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const body = joinSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Kode room atau nama pemain tidak valid.");
  try {
    const room = await joinRoom(guest.userId, body.data.code, body.data.displayName);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    await touchMember(room.id, guest.userId);
    return apiSuccess({ code: room.code, roomId: room.id });
  } catch (error) {
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Room belum dapat diakses. Periksa koneksi database." });
  }
}
