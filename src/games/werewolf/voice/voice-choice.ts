import type { Narrator, VoiceConfig } from "@/games/werewolf/voice/narrator";

/** Narrator voice picked on the voice page and remembered by this device (the host phone or TV that plays audio). */
export interface VoiceChoice { provider: "microsoft" | "elevenlabs"; effects: boolean }

const STORAGE_KEY = "pq-werewolf-voice";

/** Server default, used until the device saves its own choice. ElevenLabs needs its committed Adam pack. */
export function defaultVoiceChoice(config: VoiceConfig | null): VoiceChoice {
  return { provider: config?.provider === "elevenlabs" && config.elevenLabsPackReady ? "elevenlabs" : "microsoft", effects: config?.dramaticEffects ?? false };
}

export function parseVoiceChoice(raw: string | null): Partial<VoiceChoice> {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<VoiceChoice> | null;
    return {
      ...(value?.provider === "microsoft" || value?.provider === "elevenlabs" ? { provider: value.provider } : {}),
      ...(typeof value?.effects === "boolean" ? { effects: value.effects } : {}),
    };
  } catch {
    return {};
  }
}

export function loadVoiceChoice(config: VoiceConfig | null): VoiceChoice {
  let saved: Partial<VoiceChoice> = {};
  try { saved = parseVoiceChoice(window.localStorage.getItem(STORAGE_KEY)); } catch { /* storage blocked */ }
  const choice = { ...defaultVoiceChoice(config), ...saved };
  // A saved ElevenLabs choice falls back to Microsoft when the Adam pack is missing.
  return choice.provider === "elevenlabs" && !config?.elevenLabsPackReady ? { ...choice, provider: "microsoft" } : choice;
}

export function saveVoiceChoice(choice: VoiceChoice) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); return true; } catch { return false; }
}

/**
 * Microsoft: Ardi pack plus server-made lines that name players. ElevenLabs: the Adam pack with
 * emotion, and the nameless clip for the four named announcements (no API call during play).
 */
export function applyVoiceChoice(narrator: Narrator, choice: VoiceChoice) {
  narrator.setStaticBase(choice.provider === "elevenlabs" ? "/audio/werewolf/elevenlabs/" : "/audio/werewolf/");
  narrator.setNamedLines(choice.provider === "elevenlabs" ? "generic" : "tts");
  narrator.setEffects(choice.effects);
}
