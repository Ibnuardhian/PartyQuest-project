import { statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NIGHT_ORDER } from "@/games/werewolf/contract";
import { ONUW_NIGHT_ORDER } from "@/games/werewolf/engine/onuw/night-sequence";
import { indonesianVoices, splitSentences } from "@/games/werewolf/voice/narrator";
import { classicVoice, joinNames, NAME_LINES, nameLine, onuwVoice, packLine, renderLine, VOICE_PACK } from "@/games/werewolf/voice/templates";

describe("voice pack", () => {
  it("has all 41 lines with a generated, non-empty MP3 in public/", () => {
    expect(VOICE_PACK.items).toHaveLength(41);
    expect(VOICE_PACK.items.filter((item) => item.mode === "classic")).toHaveLength(22);
    for (const item of VOICE_PACK.items) {
      const file = path.join(process.cwd(), "public", item.file);
      expect(statSync(file).size, item.file).toBeGreaterThan(1000);
    }
    expect(VOICE_PACK.voice).toBe("id-ID-ArdiNeural");
  });

  it("covers every Classic night role, every win, and every ONUW wake-up role", () => {
    for (const role of NIGHT_ORDER) expect(classicVoice.turnStart(role).clip).toMatch(new RegExp(`turn_${role.toLowerCase()}\\.mp3$`));
    for (const faction of ["VILLAGER", "WEREWOLF", "TANNER", "LOVERS"] as const) expect(classicVoice.win(faction).clip).toBeTruthy();
    for (const { role } of ONUW_NIGHT_ORDER) {
      expect(onuwVoice.open(role).text).toMatch(/buka mata/);
      expect(onuwVoice.close(role).text).toMatch(/tutup mata/);
    }
    expect(() => packLine("TIDAK_ADA")).toThrow();
  });
});

describe("named announcements", () => {
  it("name players with a static generic clip as fallback", () => {
    expect(classicVoice.execution("Eka")).toEqual({ text: "Warga desa telah memutuskan... Eka dieksekusi hari ini!", fallbackClip: "/audio/werewolf/classic/execution_result.mp3" });
    expect(classicVoice.dawnKills(["Budi"]).text).toContain("Budi ditemukan tewas semalam");
    expect(classicVoice.dawnKills(["Budi", "Citra", "Dimas"]).text).toContain("Budi, Citra, dan Dimas ditemukan tewas!");
    expect(classicVoice.hunter("Dimas").text).toBe("Sang Pemburu, Dimas, gugur, namun ia sempat menarik pelatuk senjatanya! Dimas... pilih satu targetmu di layar sekarang!");
  });

  it("refuses missing or unknown variables", () => {
    expect(() => nameLine("EXECUTION_RESULT", {})).toThrow("executedName");
    expect(() => renderLine("{rahasia} tewas", {})).toThrow("tidak diizinkan");
  });

  it("never names players on night lines", () => {
    for (const role of NIGHT_ORDER) expect(classicVoice.turnStart(role).text).not.toMatch(/\{/);
    expect(Object.keys(NAME_LINES).sort()).toEqual(["DAWN_MULTI_KILL", "DAWN_SINGLE_KILL", "EXECUTION_RESULT", "HUNTER_REVENGE"]);
    expect(joinNames(["Budi"])).toBe("Budi");
  });
});

describe("narrator helpers", () => {
  it("splits long lines into sentences, keeping dramatic ellipses", () => {
    expect(splitSentences("Pagi telah tiba! Warga desa terbangun dengan kabar duka... Budi ditemukan tewas semalam.")).toEqual([
      "Pagi telah tiba!", "Warga desa terbangun dengan kabar duka...", "Budi ditemukan tewas semalam.",
    ]);
  });

  it("keeps only Indonesian voices for the browser fallback, natural/online ones first", () => {
    const voice = (name: string, lang: string) => ({ name, lang, voiceURI: name, localService: true, default: false }) as SpeechSynthesisVoice;
    const result = indonesianVoices([voice("Damayanti", "id-ID"), voice("Samantha", "en-US"), voice("Microsoft Gadis Online (Natural)", "id-ID")]);
    expect(result.map((item) => item.name)).toEqual(["Microsoft Gadis Online (Natural)", "Damayanti"]);
  });
});
