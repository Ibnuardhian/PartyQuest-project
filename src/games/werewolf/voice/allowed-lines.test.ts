import { describe, expect, it } from "vitest";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { classicVoice, packLine } from "@/games/werewolf/voice/templates";

const players = new Set(["Budi", "Citra", "Dimas", "Eka"]);
const isPlayer = (name: string) => players.has(name);

describe("TTS allow-list", () => {
  it("accepts the named announcements with this session's players", () => {
    for (const line of [classicVoice.dawnKills(["Budi"]), classicVoice.dawnKills(["Budi", "Citra", "Dimas"]), classicVoice.hunter("Eka"), classicVoice.execution("Citra")]) {
      expect(isAllowedNarration(line.text, isPlayer), line.text).toBe(true);
    }
  });

  it("rejects free text, static lines, unknown names, and mismatched repeats", () => {
    expect(isAllowedNarration("Halo dunia, ini teks bebas.", isPlayer)).toBe(false);
    // Static lines are served as files and never synthesized on demand.
    expect(isAllowedNarration(packLine("CLASSIC_VOTING_START").text, isPlayer)).toBe(false);
    expect(isAllowedNarration(classicVoice.dawnKills(["Orang Asing"]).text, isPlayer)).toBe(false);
    expect(isAllowedNarration(classicVoice.dawnKills(["Budi", "Mallory"]).text, isPlayer)).toBe(false);
    expect(isAllowedNarration(classicVoice.hunter("Eka").text.replace("Eka...", "Budi..."), isPlayer)).toBe(false);
    expect(isAllowedNarration(`${classicVoice.execution("Eka").text} Tambahan.`, isPlayer)).toBe(false);
    expect(isAllowedNarration("", isPlayer)).toBe(false);
  });
});
