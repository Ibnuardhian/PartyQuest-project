import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { restoreClassic } from "@/games/werewolf/server/online";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { loadMemberSession } from "@/lib/rooms/session-context";
import { EDGE_VOICES, edgeSpeech } from "@/lib/tts/edge-tts";

export const runtime = "nodejs";

const bodySchema = z.object({ sessionId: z.string().uuid(), text: z.string().min(1).max(400), voice: z.enum(EDGE_VOICES).optional() }).strict();

/**
 * Narrator audio for a Werewolf session (Microsoft Edge Neural TTS).
 * Static lines are pre-generated MP3 files; this route only voices the four announcements that
 * name players, only for the session host, and only with names of this session's players.
 */
export async function POST(request: Request) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Sesi tamu tidak ditemukan.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Permintaan suara tidak valid.");
  try {
    const loaded = await loadMemberSession(body.data.sessionId, guest.userId);
    if ("error" in loaded) return loaded.error;
    if (loaded.room.game_key !== "werewolf") return apiError(404, "not_found", "Suara hanya tersedia untuk Werewolf.");
    if (loaded.room.host_user_id !== guest.userId) return apiError(403, "host_required", "Suara moderator hanya diputar di perangkat host.");
    const names = new Set(restoreClassic(loaded.stored).public.players.map((player) => player.name));
    if (!isAllowedNarration(body.data.text, (value) => names.has(value))) return apiError(400, "text_not_allowed", "Teks bukan bagian dari naskah moderator.");
    const audio = await edgeSpeech(body.data.text, body.data.voice);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return apiError(503, "tts_unavailable", "Suara Microsoft belum tersedia; memakai suara browser.");
  }
}
