import "server-only";
import { cachedAudio } from "@/lib/tts/cache";

/**
 * ElevenLabs text-to-speech (POST /v1/text-to-speech/{voice_id}).
 * Configured only through server environment variables; the API key never reaches the browser.
 * Each request uses account credits, so every line is cached on disk after the first render.
 */

export const ELEVENLABS_DEFAULTS = {
  /** "Adam", a premade voice usable on every plan. Voice Library voices need a paid plan for API use. */
  voiceId: "pNInz6obpgDQGcFmaJgB",
  /** eleven_v4 supports audio tags ([sad], [laughs], ...) and Indonesian. */
  modelId: "eleven_v4",
  outputFormat: "mp3_44100_128",
  /** Matches the dashboard settings chosen for this project (stability 50 %, similarity 25 %). */
  voiceSettings: { stability: 0.5, similarity_boost: 0.25 },
} as const;

export interface ElevenLabsConfig { apiKey: string; voiceId: string; modelId: string; baseUrl: string }

export function elevenLabsConfig(env: Record<string, string | undefined> = process.env): ElevenLabsConfig | null {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    voiceId: env.ELEVENLABS_VOICE_ID?.trim() || ELEVENLABS_DEFAULTS.voiceId,
    modelId: env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_DEFAULTS.modelId,
    baseUrl: (env.ELEVENLABS_BASE_URL?.trim() || "https://api.elevenlabs.io").replace(/\/$/, ""),
  };
}

export class ElevenLabsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Builds the HTTP request; separated so it can be unit-tested without network access. */
export function elevenLabsRequest(text: string, config: ElevenLabsConfig) {
  const url = `${config.baseUrl}/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=${ELEVENLABS_DEFAULTS.outputFormat}`;
  const init: RequestInit = {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: config.modelId, voice_settings: ELEVENLABS_DEFAULTS.voiceSettings }),
  };
  return { url, init };
}

export async function elevenLabsSpeech(text: string, config: ElevenLabsConfig, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  return cachedAudio(`elevenlabs/${config.voiceId}`, [config.modelId, JSON.stringify(ELEVENLABS_DEFAULTS.voiceSettings), text], async () => {
    const { url, init } = elevenLabsRequest(text, config);
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      // Never echo the key; keep only the status and a short reason.
      const reason = (await response.text().catch(() => "")).slice(0, 200);
      throw new ElevenLabsError(response.status, `elevenlabs_${response.status}${reason ? `: ${reason}` : ""}`);
    }
    return Buffer.from(await response.arrayBuffer());
  });
}
