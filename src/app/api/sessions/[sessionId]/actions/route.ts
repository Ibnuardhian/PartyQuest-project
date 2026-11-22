import { z } from "zod";
import { apiError, apiSuccess, mapDatabaseError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { OnlineGameError } from "@/games/online-game";
import { applyGameAction, listOnlineMemberIds } from "@/lib/rooms/repository";
import { loadMemberSession } from "@/lib/rooms/session-context";

export const runtime = "nodejs";

// The browser sends only an intent and the version it saw, never game state or a user id.
const bodySchema = z.object({ expectedVersion: z.number().int().nonnegative(), action: z.record(z.string(), z.unknown()) }).strict();
const MAX_ATTEMPTS = 3;

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Aksi permainan tidak valid.");
  const { sessionId } = await params;
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const loaded = await loadMemberSession(sessionId, guest.userId);
      if ("error" in loaded) return loaded.error;
      const { session, room, game, stored } = loaded;
      // Commutative intents (simultaneous votes) are re-validated on the latest state instead of
      // failing on a stale version; everything else must match the version the player saw.
      const retryable = game.retryOnConflict?.(body.data.action) ?? false;
      if (!retryable && session.state_version !== body.data.expectedVersion) return apiError(409, "version_conflict", "State permainan sudah berubah. Segarkan permainan.");
      if (session.status !== "in_progress") return apiError(409, "session_finished", "Permainan ini sudah selesai.");
      const viewer = { userId: guest.userId, isHost: room.host_user_id === guest.userId };
      const next = game.applyIntent(stored, body.data.action, { ...viewer, now: Date.now(), onlineUserIds: await listOnlineMemberIds(room.id) });
      const mutation = await applyGameAction(session.id, guest.userId, session.state_version, next.publicState, next.secretState);
      if (mutation.ok) {
        const updated = { ...stored, publicState: next.publicState, secretState: next.secretState ?? stored.secretState };
        return apiSuccess({ stateVersion: mutation.state_version, ...game.view(updated, viewer) });
      }
      if (mutation.error_code === "version_conflict" && retryable && attempt < MAX_ATTEMPTS) continue;
      const mapped = mapDatabaseError(mutation.error_code ?? "") ?? { status: 409, code: "action_unavailable", message: "Aksi belum dapat disimpan." };
      return apiError(mapped.status, mapped.code, mapped.message);
    }
    return apiError(409, "version_conflict", "State permainan sudah berubah. Segarkan permainan.");
  } catch (error) {
    if (error instanceof OnlineGameError) return apiError(error.status, error.code, error.message);
    return apiError(503, "action_unavailable", "Aksi belum dapat disimpan.");
  }
}
