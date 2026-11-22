import "server-only";
import { EdgeTTS } from "node-edge-tts";
import { cachedAudio } from "@/lib/tts/cache";

/**
 * Microsoft Edge Neural TTS via node-edge-tts (the Edge "Read Aloud" online service).
 * Not an official public API: it can change without notice, so callers keep a fallback.
 * Supports prosody (rate, pitch) but no emotional styles for Indonesian voices.
 */

export const EDGE_VOICES = ["id-ID-ArdiNeural", "id-ID-GadisNeural"] as const;
export type EdgeVoice = (typeof EDGE_VOICES)[number];

export interface SpeechOptions { voice?: EdgeVoice; rate: string; pitch: string }

const PROSODY_PATTERN = /^[+-]?\d{1,3}(%|Hz)$/;

export function defaultVoice(): EdgeVoice {
  const configured = process.env.TTS_VOICE;
  return (EDGE_VOICES as readonly string[]).includes(configured ?? "") ? configured as EdgeVoice : "id-ID-ArdiNeural";
}

export async function edgeSpeech(text: string, options: SpeechOptions): Promise<Buffer> {
  const voice = options.voice ?? defaultVoice();
  const { rate, pitch } = options;
  if (!PROSODY_PATTERN.test(rate) || !PROSODY_PATTERN.test(pitch)) throw new Error("invalid_prosody");
  return cachedAudio(`edge/${voice}`, [rate, pitch, text], async () => {
    const tts = new EdgeTTS({ voice, lang: "id-ID", outputFormat: "audio-24khz-48kbitrate-mono-mp3", rate, pitch, timeout: 15_000 });
    const chunks: Buffer[] = [];
    for await (const part of tts.streamAudio(text)) if (Buffer.isBuffer(part)) chunks.push(part);
    return Buffer.concat(chunks);
  });
}
