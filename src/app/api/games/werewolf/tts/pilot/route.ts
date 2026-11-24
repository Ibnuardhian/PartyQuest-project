import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { werewolfSpeech } from "@/games/werewolf/server/voice";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { isPackText, isVoicePreset } from "@/games/werewolf/voice/templates";
import { EDGE_VOICES } from "@/lib/tts/edge-tts";
import { elevenLabsConfig } from "@/lib/tts/elevenlabs";
import { RateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(400),
  provider: z.enum(["microsoft", "elevenlabs"]).optional(),
  voice: z.enum(EDGE_VOICES).optional(),
  preset: z.string().refine(isVoicePreset).optional(),
}).strict();
const SAMPLE_NAME = /^[\p{L}\p{N} .'-]{1,24}$/u;
const pilotLimiter = new RateLimiter(60, 60_000);

/**
 * Voice pilot audio, used to compare providers, voices, and presets. Disabled in production unless
 * WEREWOLF_VOICE_PILOT=1. Only voice-pack lines or named templates with name-like sample values
 * are accepted, and a guest session is required.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.WEREWOLF_VOICE_PILOT !== "1") return apiError(404, "not_found", "Tidak ditemukan.");
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Permintaan suara tidak valid.");
  if (!pilotLimiter.allow(guest.userId)) return apiError(429, "rate_limited", "Terlalu banyak permintaan suara. Coba lagi sebentar.");
  const { text, provider } = body.data;
  if (!isPackText(text) && !isAllowedNarration(text, (value) => SAMPLE_NAME.test(value))) return apiError(400, "text_not_allowed", "Teks bukan bagian dari naskah moderator.");
  if (provider === "elevenlabs" && !elevenLabsConfig()) return apiError(503, "elevenlabs_not_configured", "ELEVENLABS_API_KEY belum diisi di .env.");
  try {
    const result = await werewolfSpeech(text, { provider: provider ?? "microsoft", voice: body.data.voice, preset: isVoicePreset(body.data.preset) ? body.data.preset : undefined });
    return new Response(new Uint8Array(result.audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400", "X-TTS-Provider": result.provider } });
  } catch {
    return apiError(503, "tts_unavailable", "Suara belum tersedia; memakai suara cadangan.");
  }
}
