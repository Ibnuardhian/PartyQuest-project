import { z } from "zod";
import { apiError, apiSuccess, mapDatabaseError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { OnlineGameError } from "@/games/online-game";
import { applyGameAction } from "@/lib/rooms/repository";
import { loadMemberSession } from "@/lib/rooms/session-context";

export const runtime = "nodejs";

// The browser sends only an intent and the version it saw, never game state or a user id.
const bodySchema = z.object({ expectedVersion: z.number().int().nonnegative(), action: z.record(z.string(), z.unknown()) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Aksi permainan tidak valid.");
  try {
    const loaded = await loadMemberSession((await params).sessionId, guest.userId);
    if ("error" in loaded) return loaded.error;
    const { session, game, stored } = loaded;
    if (session.state_version !== body.data.expectedVersion) return apiError(409, "version_conflict", "State permainan sudah berubah. Segarkan permainan.");
    if (session.status !== "in_progress") return apiError(409, "session_finished", "Permainan ini sudah selesai.");
    const nextPublic = game.applyIntent(stored, guest.userId, body.data.action, Date.now());
    const mutation = await applyGameAction(session.id, guest.userId, body.data.expectedVersion, nextPublic);
    if (!mutation.ok) {
      const mapped = mapDatabaseError(mutation.error_code ?? "") ?? { status: 409, code: "action_unavailable", message: "Aksi belum dapat disimpan." };
      return apiError(mapped.status, mapped.code, mapped.message);
    }
    return apiSuccess({ stateVersion: mutation.state_version, ...game.view({ ...stored, publicState: nextPublic }, guest.userId) });
  } catch (error) {
    if (error instanceof OnlineGameError) return apiError(error.status, error.code, error.message);
    return apiError(503, "action_unavailable", "Aksi belum dapat disimpan.");
  }
}
