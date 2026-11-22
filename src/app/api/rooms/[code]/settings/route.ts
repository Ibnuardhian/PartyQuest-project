import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { OnlineGameError } from "@/games/online-game";
import { getOnlineGame } from "@/games/online-registry";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, updateRoomSettings } from "@/lib/rooms/repository";

export const runtime = "nodejs";

const bodySchema = z.object({ settings: z.unknown() }).strict();

/** Host edits game settings in the lobby. The game validates the shape; the DB enforces host + lobby. */
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Pengaturan room tidak valid.");
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (room.host_user_id !== guest.userId) return apiError(403, "host_required", "Hanya host yang dapat mengubah pengaturan.");
    const game = getOnlineGame(room.game_key);
    if (!game) return apiError(409, "unknown_game", "Game room ini tidak tersedia.");
    const settings = game.parseSettings(body.data.settings);
    const updated = await updateRoomSettings(room.id, guest.userId, settings);
    return apiSuccess({ settings: updated?.settings ?? settings });
  } catch (error) {
    if (error instanceof OnlineGameError) return apiError(error.status, error.code, error.message);
    return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Pengaturan room belum dapat disimpan." });
  }
}
