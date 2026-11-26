import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { getOnlineGame } from "@/games/online-registry";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, renameRoomMember } from "@/lib/rooms/repository";

export const runtime = "nodejs";

const bodySchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();
const userIdSchema = z.string().uuid();

/**
 * Host renames a room member (Werewolf opts in) so nobody can pass as another player. The acting user comes
 * only from the verified cookie; the host check, lobby phase, and name uniqueness are enforced in SQL.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string; userId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const { code: rawCode, userId } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code || !userIdSchema.safeParse(userId).success) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_name", "Nama tampilan harus 1–24 karakter.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (!getOnlineGame(room.game_key)?.hostCanRenameMembers) return apiError(403, "rename_unavailable", "Game ini tidak mendukung ganti nama oleh host.");
    const renamed = await renameRoomMember(room.id, guest.userId, userId, body.data.displayName);
    return apiSuccess({ displayName: renamed?.display_name ?? body.data.displayName });
  } catch (error) {
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Nama belum dapat diganti." });
  }
}
