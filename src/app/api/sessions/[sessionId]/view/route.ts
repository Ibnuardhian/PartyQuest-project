import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { applyGameAction, findSession, findSessionSecret, touchMember } from "@/lib/rooms/repository";
import { loadMemberSession } from "@/lib/rooms/session-context";

export const runtime = "nodejs";

const FINISHED_PHASES = new Set(["finished", "GAME_OVER"]);

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  try {
    const loaded = await loadMemberSession((await params).sessionId, guest.userId);
    if ("error" in loaded) return loaded.error;
    const { room, game } = loaded;
    let { session, stored } = loaded;
    // Presence heartbeat for AFK eligibility and online dots.
    await touchMember(room.id, guest.userId);
    if (session.status === "in_progress") {
      // Server-time deadlines advance through the same version-checked mutation as player actions.
      const advanced = game.advance(stored, Date.now());
      if (advanced) {
        const mutation = await applyGameAction(session.id, guest.userId, session.state_version, advanced.publicState, advanced.secretState);
        if (mutation.ok && mutation.state_version !== null) {
          const phase = advanced.publicState.phase;
          session = { ...session, state_version: mutation.state_version, public_state: advanced.publicState, status: FINISHED_PHASES.has(phase) ? "finished" : "in_progress", phase };
          stored = { ...stored, publicState: advanced.publicState, secretState: advanced.secretState ?? stored.secretState };
        } else {
          // Someone else advanced first; show the latest committed state.
          const [latest, latestSecret] = await Promise.all([findSession(session.id), findSessionSecret(session.id)]);
          if (latest) {
            session = latest;
            stored = { ...stored, publicState: latest.public_state, secretState: latestSecret ?? stored.secretState };
          }
        }
      }
    }
    const view = game.view(stored, { userId: guest.userId, isHost: room.host_user_id === guest.userId });
    if (!view) return apiError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    return apiSuccess({ sessionId: session.id, roomId: room.id, roomCode: room.code, gameKey: room.game_key, stateVersion: session.state_version, status: session.status, serverNow: Date.now(), ...view });
  } catch {
    return apiError(503, "session_unavailable", "Permainan belum dapat dimuat.");
  }
}
