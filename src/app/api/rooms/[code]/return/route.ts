import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, returnToLobby } from "@/lib/rooms/repository";

export const runtime = "nodejs";

const returnSchema = z.object({ force: z.boolean().optional() }).strict();

/** A member reports being back in the lobby after a finished round; the host may open it early with force. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const body = returnSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return apiError(400, "invalid_input", "Permintaan tidak valid.");
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    const status = await returnToLobby(room.id, guest.userId, body.data.force === true);
    return apiSuccess({ status });
  } catch (error) {
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Room belum dapat diperbarui." });
  }
}
