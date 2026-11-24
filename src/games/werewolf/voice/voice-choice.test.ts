import { describe, expect, it } from "vitest";
import { defaultVoiceChoice, parseVoiceChoice } from "./voice-choice";

const config = { provider: "elevenlabs", namedLines: "generic", staticBase: "/audio/werewolf/elevenlabs/", elevenLabsConfigured: true, elevenLabsPackReady: true, dramaticEffects: false } as const;

describe("voice choice", () => {
  it("defaults to the server provider only when its pack is ready", () => {
    expect(defaultVoiceChoice(config)).toEqual({ provider: "elevenlabs", effects: false });
    expect(defaultVoiceChoice({ ...config, elevenLabsPackReady: false })).toEqual({ provider: "microsoft", effects: false });
    expect(defaultVoiceChoice(null)).toEqual({ provider: "microsoft", effects: false });
  });

  it("keeps only valid saved fields", () => {
    expect(parseVoiceChoice('{"provider":"elevenlabs","effects":true}')).toEqual({ provider: "elevenlabs", effects: true });
    expect(parseVoiceChoice('{"provider":"openai","effects":"yes"}')).toEqual({});
    expect(parseVoiceChoice("not json")).toEqual({});
    expect(parseVoiceChoice(null)).toEqual({});
  });
});
