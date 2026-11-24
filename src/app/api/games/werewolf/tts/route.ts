import { cookies } from "next/headers";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import type { ClassicPublicState } from "@/games/werewolf/contract";
import { werewolfSpeech } from "@/games/werewolf/server/voice";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { findRoomById, findSession, isActiveMember } from "@/lib/rooms/repository";
import { TV_COOKIE_NAME, verifyTvToken } from "@/lib/rooms/tv";
import { EDGE_VOICES } from "@/lib/tts/edge-tts";
import { RateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({ sessionId: z.string().uuid(), text: z.string().min(1).max(400), voice: z.enum(EDGE_VOICES).optional() }).strict();
const ttsLimiter = new RateLimiter(30, 60_000);

/**
 * Narrator audio for a Werewolf session (ElevenLabs when configured, else Microsoft Edge Neural).
 * Static lines are pre-generated MP3 files; this route only voices the four announcements that
 * name players, only with names of this session's players, and only for the single audio device:
 * the session host, or a TV paired to the room. Private state is never read here.
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Permintaan suara tidak valid.");
  try {
    const session = await findSession<ClassicPublicState>(body.data.sessionId);
    const room = session ? await findRoomById(session.room_id) : null;
    if (!session || !room) return apiError(404, "session_not_found", "Permainan tidak ditemukan.");
    if (room.game_key !== "werewolf") return apiError(404, "not_found", "Suara hanya tersedia untuk Werewolf.");
    const guest = await requireGuest();
    const isHost = Boolean(guest && room.host_user_id === guest.userId && await isActiveMember(room.id, guest.userId));
    const isTv = !isHost && await verifyTvToken((await cookies()).get(TV_COOKIE_NAME)?.value, room.id);
    if (!isHost && !isTv) return apiError(403, "host_required", "Suara moderator hanya diputar di perangkat host atau TV.");
    // A game needs only a handful of named lines per minute; more means a runaway client.
    if (!ttsLimiter.allow(room.id)) return apiError(429, "rate_limited", "Terlalu banyak permintaan suara. Coba lagi sebentar.");
    const names = new Set(session.public_state.players.map((player) => player.name));
    if (!isAllowedNarration(body.data.text, (value) => names.has(value))) return apiError(400, "text_not_allowed", "Teks bukan bagian dari naskah moderator.");
    const { audio, provider } = await werewolfSpeech(body.data.text, { voice: body.data.voice });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400", "X-TTS-Provider": provider } });
  } catch {
    return apiError(503, "tts_unavailable", "Suara moderator belum tersedia; memakai suara cadangan.");
  }
}
