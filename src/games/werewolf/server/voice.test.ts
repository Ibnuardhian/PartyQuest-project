import { describe, expect, it } from "vitest";
import { configuredProvider, STATIC_PACK_BASE } from "@/games/werewolf/server/voice";

describe("Werewolf voice provider", () => {
  it("uses ElevenLabs only when selected and a key is present", () => {
    expect(configuredProvider({})).toBe("microsoft");
    expect(configuredProvider({ TTS_PROVIDER: "elevenlabs" })).toBe("microsoft");
    expect(configuredProvider({ TTS_PROVIDER: "ElevenLabs", ELEVENLABS_API_KEY: "sk_x" })).toBe("elevenlabs");
    expect(configuredProvider({ TTS_PROVIDER: "microsoft", ELEVENLABS_API_KEY: "sk_x" })).toBe("microsoft");
  });

  it("keeps the ElevenLabs pack in its own folder with the same file names", () => {
    expect(STATIC_PACK_BASE.microsoft).toBe("/audio/werewolf/");
    expect(STATIC_PACK_BASE.elevenlabs.startsWith(STATIC_PACK_BASE.microsoft)).toBe(true);
  });
});
