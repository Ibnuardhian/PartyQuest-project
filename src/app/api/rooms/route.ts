import { z } from "zod";
import { apiError, apiSuccess, databaseErrorResponse, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { OnlineGameError } from "@/games/online-game";
import { getOnlineGame } from "@/games/online-registry";
import { generateRoomCode } from "@/lib/room-code";
import { createRoom } from "@/lib/rooms/repository";
import { isDatabaseError } from "@/lib/db/pool";

export const runtime = "nodejs";

const createRoomSchema = z.object({
  gameKey: z.string().default("undercover"),
  displayName: z.string().trim().min(1).max(24),
  settings: z.unknown(),
}).strict();

export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const body = createRoomSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Nama atau pengaturan room tidak valid.");
  const game = getOnlineGame(body.data.gameKey);
  if (!game) return apiError(400, "unknown_game", "Game ini belum tersedia untuk Online Room.");
  let settings: unknown;
  try {
    settings = game.parseSettings(body.data.settings);
  } catch (error) {
    if (error instanceof OnlineGameError) return apiError(error.status, error.code, error.message);
    throw error;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const room = await createRoom(guest.userId, generateRoomCode(), body.data.displayName, settings);
      if (room) return apiSuccess({ code: room.code, roomId: room.id }, 201);
    } catch (error) {
      // 23505 on game_rooms_code_key: a random code collided, so retry with a new one.
      if (isDatabaseError(error) && error.code === "23505" && attempt < 4) continue;
      return databaseErrorResponse(error, { status: 503, code: "room_unavailable", message: "Room belum dapat dibuat. Coba lagi sebentar." });
    }
  }
  return apiError(503, "room_unavailable", "Room belum dapat dibuat. Coba lagi sebentar.");
}
