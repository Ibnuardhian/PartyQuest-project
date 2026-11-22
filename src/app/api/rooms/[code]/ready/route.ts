import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, setRoomReady } from "@/lib/rooms/repository";

export const runtime = "nodejs";

const readySchema = z.object({ ready: z.boolean() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const body = readySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Status siap tidak valid.");
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    await setRoomReady(room.id, guest.userId, body.data.ready);
    return apiSuccess({ ready: body.data.ready });
  } catch (error) {
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Status room belum dapat diperbarui." });
  }
}
