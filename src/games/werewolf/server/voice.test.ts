import { describe, expect, it } from "vitest";
import { configuredNamedLines, configuredProvider, elevenLabsPackReady, STATIC_PACK_BASE } from "@/games/werewolf/server/voice";

describe("Werewolf voice provider", () => {
  it("uses ElevenLabs only when selected and a key is present", () => {
    expect(configuredProvider({})).toBe("microsoft");
    expect(configuredProvider({ TTS_PROVIDER: "elevenlabs" })).toBe("microsoft");
    expect(configuredProvider({ TTS_PROVIDER: "ElevenLabs", ELEVENLABS_API_KEY: "sk_x" })).toBe("elevenlabs");
    expect(configuredProvider({ TTS_PROVIDER: "microsoft", ELEVENLABS_API_KEY: "sk_x" })).toBe("microsoft");
  });

  it("plays nameless clips for named announcements with ElevenLabs unless overridden", () => {
    expect(configuredNamedLines({})).toBe("tts");
    expect(configuredNamedLines({ TTS_PROVIDER: "elevenlabs", ELEVENLABS_API_KEY: "sk_x" })).toBe("generic");
    expect(configuredNamedLines({ TTS_PROVIDER: "elevenlabs", ELEVENLABS_API_KEY: "sk_x", TTS_NAMED_LINES: "tts" })).toBe("tts");
    expect(configuredNamedLines({ TTS_NAMED_LINES: "generic" })).toBe("generic");
  });

  it("keeps the ElevenLabs pack in its own folder with the same file names", () => {
    expect(STATIC_PACK_BASE.microsoft).toBe("/audio/werewolf/");
    expect(STATIC_PACK_BASE.elevenlabs.startsWith(STATIC_PACK_BASE.microsoft)).toBe(true);
    // The committed ElevenLabs pack (Adam, eleven_v4 with emotion) is complete.
    expect(elevenLabsPackReady()).toBe(true);
  });
});
