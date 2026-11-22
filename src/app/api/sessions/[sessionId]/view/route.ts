import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { CLUE_TURN_DURATION_MS, type GameSettings, type GameState, type PublicState, type SecretState } from "@/games/game-contract";
import { undercoverGame } from "@/games/undercover/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastRoomChanged } from "@/lib/supabase/realtime";

interface SessionRow { id: string; room_id: string; state_version: number; public_state: PublicState; round_no: number; status: string; phase: string; }

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  const { sessionId } = await params;
  try {
    const admin = createAdminClient();
    const { data: rawSession } = await admin.from("game_sessions").select("id,room_id,state_version,public_state,round_no,status,phase").eq("id", sessionId).maybeSingle();
    if (!rawSession) return apiError(404, "session_not_found", "Permainan tidak ditemukan.");
    let session = rawSession as SessionRow;
    const { data: member } = await admin.from("room_members").select("user_id").eq("room_id", session.room_id).eq("user_id", guest.userId).is("left_at", null).maybeSingle();
    if (!member) return apiError(403, "not_a_member", "Kamu bukan anggota permainan ini.");
    const [{ data: room }, { data: privateRow }] = await Promise.all([
      admin.from("game_rooms").select("code,settings").eq("id", session.room_id).maybeSingle(),
      admin.from("game_private_state").select("private_state").eq("session_id", session.id).maybeSingle(),
    ]);
    if (!room || !privateRow) return apiError(503, "session_unavailable", "State permainan belum tersedia.");
    const state: GameState = { public: { ...session.public_state, clueDeadlineAt: session.public_state.clueDeadlineAt ?? null }, secret: privateRow.private_state as SecretState, settings: room.settings as GameSettings };
    if (!state.public.players.some((player) => player.id === guest.userId)) return apiError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    const serverNow = Date.now();
    if (state.public.phase === "clue" && session.status === "in_progress") {
      let updatedState: GameState | null = null;
      const deadlineMs = state.public.clueDeadlineAt ? Date.parse(state.public.clueDeadlineAt) : Number.NaN;
      if (!Number.isFinite(deadlineMs)) {
        updatedState = { ...state, public: { ...state.public, clueDeadlineAt: new Date(serverNow + CLUE_TURN_DURATION_MS).toISOString() } };
      } else if (deadlineMs <= serverNow) {
        const activePlayer = state.public.players.filter((player) => player.alive)[state.public.clueIndex];
        if (activePlayer) updatedState = undercoverGame.applyAction(state, { type: "submit-clue", playerId: activePlayer.id }, serverNow);
      }
      if (updatedState) {
        const { data: result, error } = await admin.rpc("apply_game_action", {
          p_session_id: session.id,
          p_user_id: guest.userId,
          p_expected_version: session.state_version,
          p_public_state: updatedState.public,
        });
        const mutation = Array.isArray(result) ? result[0] : result;
        if (!error && mutation?.ok) {
          session = { ...session, state_version: mutation.state_version, public_state: updatedState.public, status: updatedState.public.phase === "finished" ? "finished" : "in_progress", phase: updatedState.public.phase };
          Object.assign(state, updatedState);
          await broadcastRoomChanged(session.room_id, mutation.state_version);
        } else {
          const { data: latest } = await admin.from("game_sessions").select("id,room_id,state_version,public_state,round_no,status,phase").eq("id", sessionId).maybeSingle();
          if (latest) {
            session = latest as SessionRow;
            Object.assign(state, { public: { ...session.public_state, clueDeadlineAt: session.public_state.clueDeadlineAt ?? null } });
          }
        }
      }
    }
    const view = undercoverGame.getPlayerView(state, guest.userId);
    if (!view) return apiError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    return apiSuccess({ sessionId, roomId: session.room_id, roomCode: room.code, stateVersion: session.state_version, round: state.public.round, status: session.status, serverNow: Date.now(), view, hasVoted: Boolean(state.public.votes[guest.userId]), votesSubmitted: Object.keys(state.public.votes).length });
  } catch {
    return apiError(503, "session_unavailable", "Permainan belum dapat dimuat.");
  }
}
