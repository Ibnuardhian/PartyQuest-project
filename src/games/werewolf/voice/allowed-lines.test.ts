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

describe("TTS allow-list: Phase 8 day announcements", () => {
  const lines = [
    "Tunggu! Budi ternyata seorang Pangeran... eksekusi dibatalkan!",
    "Sang Troublemaker, Citra, memakai suara gandanya... satu suara tambahan dihitung hari ini!",
    "Sebuah mantra jatuh semalam... Dimas dibungkam dan tidak boleh bicara hari ini.",
    "Gigitan vampir meninggalkan tanda semalam... Eka akan binasa pada voting berikutnya.",
  ];
  it("accepts each named line only with a real player name", () => {
    for (const text of lines) expect(isAllowedNarration(text, isPlayer)).toBe(true);
    expect(isAllowedNarration(lines[0]!.replace("Budi", "Zorro"), isPlayer)).toBe(false);
    expect(isAllowedNarration("Tunggu! Budi ternyata seorang Werewolf... dieksekusi!", isPlayer)).toBe(false);
  });
});
