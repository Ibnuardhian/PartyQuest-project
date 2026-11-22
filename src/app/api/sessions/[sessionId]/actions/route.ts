import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import type { GameAction, GameSettings, GameState, PublicState, SecretState } from "@/games/game-contract";
import { undercoverGame } from "@/games/undercover/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastRoomChanged } from "@/lib/supabase/realtime";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirm-reveal") }).strict(),
  z.object({ type: z.literal("submit-clue") }).strict(),
  z.object({ type: z.literal("finish-discussion") }).strict(),
  z.object({ type: z.literal("cast-vote"), targetPlayerId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("guess-civilian-word"), guess: z.string().trim().min(1).max(60) }).strict(),
]);
const bodySchema = z.object({ expectedVersion: z.number().int().nonnegative(), action: actionSchema }).strict();
interface SessionRow { id: string; room_id: string; state_version: number; public_state: PublicState; status: string; }

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Aksi permainan tidak valid.");
  const { sessionId } = await params;
  try {
    const admin = createAdminClient();
    const { data: sessionData } = await admin.from("game_sessions").select("id,room_id,state_version,public_state,status").eq("id", sessionId).maybeSingle();
    if (!sessionData) return apiError(404, "session_not_found", "Permainan tidak ditemukan.");
    const session = sessionData as SessionRow;
    const { data: member } = await admin.from("room_members").select("user_id").eq("room_id", session.room_id).eq("user_id", guest.userId).is("left_at", null).maybeSingle();
    if (!member) return apiError(403, "not_a_member", "Kamu bukan anggota permainan ini.");
    if (session.state_version !== body.data.expectedVersion) return apiError(409, "version_conflict", "State permainan sudah berubah. Segarkan permainan.");
    if (session.status !== "in_progress") return apiError(409, "session_finished", "Permainan ini sudah selesai.");
    const [{ data: privateRow }, { data: room }] = await Promise.all([
      admin.from("game_private_state").select("private_state").eq("session_id", sessionId).maybeSingle(),
      admin.from("game_rooms").select("settings").eq("id", session.room_id).maybeSingle(),
    ]);
    if (!privateRow || !room) return apiError(503, "session_unavailable", "State permainan belum tersedia.");
    const state: GameState = { public: session.public_state, secret: privateRow.private_state as SecretState, settings: room.settings as GameSettings };
    if (!state.public.players.some((player) => player.id === guest.userId)) return apiError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    const requestAction = body.data.action;
    let action: GameAction;
    switch (requestAction.type) {
      case "confirm-reveal": action = { type: requestAction.type, playerId: guest.userId }; break;
      case "submit-clue": action = { type: requestAction.type, playerId: guest.userId }; break;
      case "finish-discussion": action = requestAction; break;
      case "cast-vote": action = { type: requestAction.type, playerId: guest.userId, targetPlayerId: requestAction.targetPlayerId }; break;
      case "guess-civilian-word": action = { type: requestAction.type, playerId: guest.userId, guess: requestAction.guess }; break;
    }
    const updatedState = undercoverGame.applyAction(state, action);
    const { data: result, error } = await admin.rpc("apply_game_action", {
      p_session_id: sessionId,
      p_user_id: guest.userId,
      p_expected_version: body.data.expectedVersion,
      p_public_state: updatedState.public,
    });
    if (error) return apiError(503, "action_unavailable", "Aksi belum dapat disimpan.");
    const mutation = Array.isArray(result) ? result[0] : result;
    if (!mutation?.ok) {
      const code = mutation?.error_code === "version_conflict" ? "version_conflict" : mutation?.error_code ?? "action_unavailable";
      const status = code === "version_conflict" ? 409 : code === "not_a_member" ? 403 : 409;
      return apiError(status, code, code === "version_conflict" ? "State permainan sudah berubah. Segarkan permainan." : "Aksi belum dapat disimpan.");
    }
    await broadcastRoomChanged(session.room_id, mutation.state_version);
    return apiSuccess({ stateVersion: mutation.state_version, view: undercoverGame.getPlayerView(updatedState, guest.userId) });
  } catch {
    return apiError(400, "invalid_action", "Aksi tidak sesuai dengan fase permainan saat ini.");
  }
}
