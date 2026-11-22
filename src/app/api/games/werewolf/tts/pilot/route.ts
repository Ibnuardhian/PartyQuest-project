import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { FACTION_LABELS } from "@/games/werewolf/ui/labels";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { EDGE_VOICES, edgeSpeech } from "@/lib/tts/edge-tts";

export const runtime = "nodejs";

const bodySchema = z.object({ text: z.string().min(1).max(400), voice: z.enum(EDGE_VOICES).optional() }).strict();
const SAMPLE_NAME = /^[\p{L}\p{N} .'-]{1,24}$/u;

/**
 * Voice pilot page audio. Disabled in production unless WEREWOLF_VOICE_PILOT=1.
 * Still template-only (sample names must look like names), and requires a guest session.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.WEREWOLF_VOICE_PILOT !== "1") return apiError(404, "not_found", "Tidak ditemukan.");
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_input", "Permintaan suara tidak valid.");
  const allowed = isAllowedNarration(body.data.text, {
    roleNames: Object.values(CLASSIC_ROLE_INFO).map((info) => info.name),
    factionNames: Object.values(FACTION_LABELS),
    isPlayerName: (value) => SAMPLE_NAME.test(value),
  });
  if (!allowed) return apiError(400, "text_not_allowed", "Teks bukan bagian dari naskah moderator.");
  try {
    const audio = await edgeSpeech(body.data.text, body.data.voice);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return apiError(503, "tts_unavailable", "Suara Microsoft belum tersedia; memakai suara browser.");
  }
}
