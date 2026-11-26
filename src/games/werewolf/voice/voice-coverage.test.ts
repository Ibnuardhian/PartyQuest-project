import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { WinnerFaction } from "@/games/werewolf/contract";
import { NIGHT_ORDER } from "@/games/werewolf/contract";
import { classicVoice, VOICE_PACK } from "@/games/werewolf/voice/templates";

/**
 * Guards "every role that speaks has a voice": a role that wakes at night (NIGHT_ORDER) needs its own
 * turn line, every winning faction needs a win line, and every line in the pack must exist as an MP3
 * for both voices (Microsoft and ElevenLabs Adam). Adding a night role without voice fails here instead
 * of silently playing the "your turn is over" clip.
 */
const FACTIONS: WinnerFaction[] = ["VILLAGER", "WEREWOLF", "TANNER", "LOVERS", "LONE_WOLF", "VAMPIRE"];
const publicFile = (url: string) => path.join(process.cwd(), "public", url);
const elevenLabsFile = (url: string) => publicFile(url.replace("/audio/werewolf/", "/audio/werewolf/elevenlabs/"));

describe("Werewolf voice coverage", () => {
  it("has its own turn line for every role that wakes at night", () => {
    const fallback = classicVoice.turnEnd().clip;
    const seen = new Set<string>();
    for (const role of NIGHT_ORDER) {
      const line = classicVoice.turnStart(role);
      expect(line.clip, `${role} falls back to the end-of-turn clip`).toBeDefined();
      expect(line.clip, `${role} has no turn line`).not.toBe(fallback);
      expect(line.text.length).toBeGreaterThan(10);
      expect(seen.has(line.clip!), `${role} shares a clip`).toBe(false);
      seen.add(line.clip!);
    }
  });

  it("has a win line for every winning faction", () => {
    const clips = FACTIONS.map((faction) => classicVoice.win(faction).clip);
    expect(clips.every(Boolean)).toBe(true);
    expect(new Set(clips).size).toBe(FACTIONS.length);
  });

  it("has an MP3 for every pack line, for both Microsoft and ElevenLabs", () => {
    const missing = VOICE_PACK.items.flatMap((item) => [publicFile(item.file), elevenLabsFile(item.file)].filter((file) => !existsSync(file)).map((file) => path.relative(process.cwd(), file)));
    expect(missing).toEqual([]);
  });
});
