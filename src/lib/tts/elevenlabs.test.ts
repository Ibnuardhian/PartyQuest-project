import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ELEVENLABS_DEFAULTS, elevenLabsConfig, ElevenLabsError, elevenLabsRequest, elevenLabsSpeech } from "@/lib/tts/elevenlabs";

const config = { apiKey: "sk_test_key", voiceId: "voice123", modelId: "eleven_multilingual_v2", baseUrl: "https://api.elevenlabs.io" };

describe("ElevenLabs configuration", () => {
  it("is off without a key and applies defaults when a key is set", () => {
    expect(elevenLabsConfig({})).toBeNull();
    expect(elevenLabsConfig({ ELEVENLABS_API_KEY: "   " })).toBeNull();
    expect(elevenLabsConfig({ ELEVENLABS_API_KEY: "sk_abc" })).toEqual({ apiKey: "sk_abc", voiceId: ELEVENLABS_DEFAULTS.voiceId, modelId: "eleven_v4", baseUrl: "https://api.elevenlabs.io" });
    expect(elevenLabsConfig({ ELEVENLABS_API_KEY: "sk_abc", ELEVENLABS_VOICE_ID: "deep", ELEVENLABS_BASE_URL: "https://api.eu.residency.elevenlabs.io/" })).toMatchObject({ voiceId: "deep", baseUrl: "https://api.eu.residency.elevenlabs.io" });
  });

  it("builds the documented text-to-speech request", () => {
    const { url, init } = elevenLabsRequest("Halo desa", config);
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice123?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "xi-api-key": "sk_test_key", "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ text: "Halo desa", model_id: "eleven_multilingual_v2", voice_settings: ELEVENLABS_DEFAULTS.voiceSettings });
  });
});

describe("ElevenLabs speech", () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), "pq-tts-")); vi.stubEnv("TTS_CACHE_DIR", dir); });
  afterAll(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

  it("returns audio and serves repeats from the disk cache", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([0xff, 0xf3, 0x64, 0xc4]), { status: 200 }));
    const first = await elevenLabsSpeech("Satu baris", config, fetchMock as unknown as typeof fetch);
    const second = await elevenLabsSpeech("Satu baris", config, fetchMock as unknown as typeof fetch);
    expect(first.subarray(0, 2).toString("hex")).toBe("fff3");
    expect(second.equals(first)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports API errors with the status and without the key", async () => {
    const fetchMock = vi.fn(async () => new Response("invalid_api_key", { status: 401 }));
    const error = await elevenLabsSpeech("Baris lain", config, fetchMock as unknown as typeof fetch).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ElevenLabsError);
    expect((error as ElevenLabsError).status).toBe(401);
    expect((error as Error).message).not.toContain("sk_test_key");
  });
});
