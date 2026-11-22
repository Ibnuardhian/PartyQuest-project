import "server-only";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getOnlineGame } from "@/games/online-registry";
import type { StoredSession } from "@/games/online-game";
import { findRoomById, findSession, findSessionSecret, isActiveMember } from "@/lib/rooms/repository";

const sessionIdSchema = z.string().uuid();

/** Verifies active membership BEFORE any private state is read. Returns a response on failure. */
export async function loadMemberSession(rawSessionId: string, userId: string) {
  const parsedId = sessionIdSchema.safeParse(rawSessionId);
  if (!parsedId.success) return { error: apiError(404, "session_not_found", "Permainan tidak ditemukan.") } as const;
  const sessionId = parsedId.data;
  const session = await findSession(sessionId);
  if (!session) return { error: apiError(404, "session_not_found", "Permainan tidak ditemukan.") } as const;
  if (!(await isActiveMember(session.room_id, userId))) return { error: apiError(403, "not_a_member", "Kamu bukan anggota permainan ini.") } as const;
  const [room, secretState] = await Promise.all([findRoomById(session.room_id), findSessionSecret(sessionId)]);
  const game = room ? getOnlineGame(room.game_key) : null;
  if (!room || secretState === null || !game) return { error: apiError(503, "session_unavailable", "State permainan belum tersedia.") } as const;
  const stored: StoredSession = { publicState: session.public_state, secretState, settings: room.settings };
  return { session, room, game, stored } as const;
}
