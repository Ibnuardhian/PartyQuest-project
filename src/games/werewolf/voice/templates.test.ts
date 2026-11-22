import { describe, expect, it } from "vitest";
import { ONUW_ROLES } from "@/games/werewolf/contract";
import { ONUW_NIGHT_ORDER } from "@/games/werewolf/engine/onuw/night-sequence";
import { indonesianVoices, splitSentences } from "@/games/werewolf/voice/narrator";
import { ALLOWED_VARIABLES, CLASSIC_LINES, countWords, nightOrdinal, ONUW_LINES, ONUW_ROLE_LINES, renderLine } from "@/games/werewolf/voice/templates";

describe("voice templates", () => {
  it("fills placeholders and refuses to speak a line with a missing variable", () => {
    expect(renderLine(CLASSIC_LINES.DAWN_MULTI_KILL, { victimCount: countWords(2) })).toContain("dua warga ditemukan tewas");
    expect(renderLine(CLASSIC_LINES.NIGHT_INTRO, { nightOrdinal: nightOrdinal(2) })).toContain("Malam kedua telah tiba.");
    expect(() => renderLine(CLASSIC_LINES.NIGHT_TURN_START, {})).toThrow("roleName");
    expect(() => renderLine(CLASSIC_LINES.DAY_START, { minutes: "" })).toThrow("minutes");
    expect(() => renderLine("{victimName} tewas", { victimName: "Budi" })).toThrow("tidak diizinkan");
  });

  it("speaks nights and counts as words", () => {
    expect([1, 3, 12, 25].map(nightOrdinal)).toEqual(["pertama", "ketiga", "kedua belas", "ke-25"]);
    expect([1, 2, 11, 16, 20].map(countWords)).toEqual(["satu", "dua", "sebelas", "enam belas", "20"]);
  });

  it("never names players: every placeholder is a role, count, night, minutes, or faction", () => {
    const all = [...Object.values(CLASSIC_LINES), ...Object.values(ONUW_LINES), ...Object.values(ONUW_ROLE_LINES).flatMap((line) => [line!.open, line!.close])];
    const used = new Set(all.flatMap((line) => [...line.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!)));
    for (const name of used) expect(ALLOWED_VARIABLES).toContain(name);
  });

  it("has open and close lines for every role in the ONUW wake-up order", () => {
    for (const { role } of ONUW_NIGHT_ORDER) {
      expect(ONUW_ROLE_LINES[role]?.open).toMatch(/buka mata/);
      expect(ONUW_ROLE_LINES[role]?.close).toMatch(/tutup mata/);
    }
    expect(ONUW_ROLES.filter((role) => ONUW_ROLE_LINES[role]).length).toBe(ONUW_NIGHT_ORDER.length);
  });
});

describe("narrator helpers", () => {
  it("splits long lines into sentences, keeping dramatic ellipses", () => {
    expect(splitSentences("Pagi telah tiba! Warga desa terbangun dengan kabar duka... Budi ditemukan tewas semalam.")).toEqual([
      "Pagi telah tiba!", "Warga desa terbangun dengan kabar duka...", "Budi ditemukan tewas semalam.",
    ]);
    expect(splitSentences("Tanpa tanda baca")).toEqual(["Tanpa tanda baca"]);
  });

  it("keeps only Indonesian voices, natural/online ones first", () => {
    const voice = (name: string, lang: string) => ({ name, lang, voiceURI: name, localService: true, default: false }) as SpeechSynthesisVoice;
    const result = indonesianVoices([voice("Damayanti", "id-ID"), voice("Samantha", "en-US"), voice("Microsoft Gadis Online (Natural)", "id-ID"), voice("Old", "id_ID")]);
    expect(result.map((item) => item.name)).toEqual(["Microsoft Gadis Online (Natural)", "Damayanti", "Old"]);
  });
});
