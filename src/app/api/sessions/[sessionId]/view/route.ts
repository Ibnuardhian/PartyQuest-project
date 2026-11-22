import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { applyGameAction, findSession } from "@/lib/rooms/repository";
import { loadMemberSession } from "@/lib/rooms/session-context";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  try {
    const loaded = await loadMemberSession((await params).sessionId, guest.userId);
    if ("error" in loaded) return loaded.error;
    const { room, game } = loaded;
    let { session, stored } = loaded;
    if (session.status === "in_progress") {
      // Server-time deadlines advance through the same version-checked mutation as player actions.
      const advanced = game.advance(stored, Date.now());
      if (advanced) {
        const mutation = await applyGameAction(session.id, guest.userId, session.state_version, advanced);
        if (mutation.ok && mutation.state_version !== null) {
          session = { ...session, state_version: mutation.state_version, public_state: advanced, status: advanced.phase === "finished" ? "finished" : "in_progress", phase: advanced.phase };
          stored = { ...stored, publicState: advanced };
        } else {
          const latest = await findSession(session.id);
          if (latest) {
            session = latest;
            stored = { ...stored, publicState: latest.public_state };
          }
        }
      }
    }
    const view = game.view(stored, guest.userId);
    if (!view) return apiError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    return apiSuccess({ sessionId: session.id, roomId: room.id, roomCode: room.code, gameKey: room.game_key, stateVersion: session.state_version, status: session.status, serverNow: Date.now(), ...view });
  } catch {
    return apiError(503, "session_unavailable", "Permainan belum dapat dimuat.");
  }
}
