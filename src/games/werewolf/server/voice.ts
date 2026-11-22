import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { ACTIVE_PRESET, elevenLabsText, stripAudioTags, supportsAudioTags, VOICE_PACK, VOICE_PRESETS, type VoicePresetId } from "@/games/werewolf/voice/templates";
import { edgeSpeech, type EdgeVoice } from "@/lib/tts/edge-tts";
import { elevenLabsConfig, elevenLabsSpeech } from "@/lib/tts/elevenlabs";

/**
 * Chooses how the Werewolf narrator sounds.
 * TTS_PROVIDER=elevenlabs + ELEVENLABS_API_KEY -> ElevenLabs; otherwise Microsoft Edge Neural.
 * ElevenLabs failures fall back to Microsoft so the narrator keeps talking.
 */

export type VoiceProvider = "microsoft" | "elevenlabs";

export const STATIC_PACK_BASE: Record<VoiceProvider, string> = {
  microsoft: "/audio/werewolf/",
  elevenlabs: "/audio/werewolf/elevenlabs/",
};

export function configuredProvider(env: Record<string, string | undefined> = process.env): VoiceProvider {
  return env.TTS_PROVIDER?.trim().toLowerCase() === "elevenlabs" && elevenLabsConfig(env) ? "elevenlabs" : "microsoft";
}

/** True once `npm run voice:generate -- --provider elevenlabs` has produced every file of the ElevenLabs pack. */
export function elevenLabsPackReady() {
  return VOICE_PACK.items.every((item) => existsSync(path.join(process.cwd(), "public", item.file.replace(STATIC_PACK_BASE.microsoft, STATIC_PACK_BASE.elevenlabs))));
}

/** Public narrator settings for the browser (no secrets). */
export function voiceConfig() {
  const provider = configuredProvider();
  const packReady = provider === "elevenlabs" && elevenLabsPackReady();
  return {
    provider,
    elevenLabsConfigured: elevenLabsConfig() !== null,
    elevenLabsPackReady: elevenLabsPackReady(),
    /** Static clips come from the ElevenLabs pack only when it exists; otherwise the Microsoft pack. */
    staticBase: packReady ? STATIC_PACK_BASE.elevenlabs : STATIC_PACK_BASE.microsoft,
    dramaticEffects: VOICE_PACK.dramaticEffects,
  };
}

export async function werewolfSpeech(text: string, options: { provider?: VoiceProvider; preset?: VoicePresetId; voice?: EdgeVoice } = {}) {
  const provider = options.provider ?? configuredProvider();
  const elevenLabs = provider === "elevenlabs" ? elevenLabsConfig() : null;
  if (elevenLabs) {
    try {
      // Emotional wording (audio tags) only for models that understand them.
      const emotional = elevenLabsText(text);
      const spoken = supportsAudioTags(elevenLabs.modelId) ? emotional : stripAudioTags(emotional);
      return { audio: await elevenLabsSpeech(spoken, elevenLabs), provider: "elevenlabs" as const };
    } catch {
      // Fall through to Microsoft.
    }
  }
  const { rate, pitch } = VOICE_PRESETS[options.preset ?? ACTIVE_PRESET];
  return { audio: await edgeSpeech(text, { voice: options.voice, rate, pitch }), provider: "microsoft" as const };
}
