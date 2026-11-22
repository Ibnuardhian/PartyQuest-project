import { describe, expect, it } from "vitest";
import { isAllowedNarration } from "@/games/werewolf/voice/allowed-lines";
import { CLASSIC_LINES, joinNames, nightOrdinal, ONUW_LINES, ONUW_ROLE_LINES, renderLine } from "@/games/werewolf/voice/templates";

const players = new Set(["Budi", "Citra", "Dimas", "Eka"]);
const allowed = { roleNames: ["Werewolf", "Seer", "Doctor"], factionNames: ["Warga Desa", "Werewolf"], isPlayerName: (name: string) => players.has(name) };

describe("TTS allow-list", () => {
  it("accepts narrator lines filled with this session's names and allowed values", () => {
    const lines = [
      renderLine(CLASSIC_LINES.NIGHT_INTRO, { nightOrdinal: nightOrdinal(3) }),
      renderLine(CLASSIC_LINES.NIGHT_TURN_START, { roleName: "Seer" }),
      renderLine(CLASSIC_LINES.DAWN_SINGLE_KILL, { victimName: "Budi" }),
      renderLine(CLASSIC_LINES.DAWN_MULTI_KILL, { victimList: joinNames(["Budi", "Citra", "Dimas"]) }),
      renderLine(CLASSIC_LINES.HUNTER_TRIGGER, { hunterName: "Eka" }),
      renderLine(CLASSIC_LINES.EXECUTION_RESULT, { executedName: "Citra" }),
      renderLine(CLASSIC_LINES.DAY_START, { minutes: "tiga" }),
      renderLine(CLASSIC_LINES.GAME_OVER, { winningFaction: "Warga Desa" }),
      CLASSIC_LINES.DAWN_NO_KILL,
      ONUW_LINES.ONUW_VOTE,
      ONUW_ROLE_LINES.SEER!.open,
    ];
    for (const line of lines) expect(isAllowedNarration(line, allowed), line).toBe(true);
  });

  it("rejects free text, unknown names, unknown roles, and mismatched repeats", () => {
    expect(isAllowedNarration("Halo dunia, ini teks bebas.", allowed)).toBe(false);
    expect(isAllowedNarration(renderLine(CLASSIC_LINES.DAWN_SINGLE_KILL, { victimName: "Orang Asing" }), allowed)).toBe(false);
    expect(isAllowedNarration(renderLine(CLASSIC_LINES.NIGHT_TURN_START, { roleName: "Penyihir Gelap" }), allowed)).toBe(false);
    expect(isAllowedNarration("Pemburu Eka gugur, namun ia sempat menarik pelatuk senjatanya! Budi, pilih satu targetmu sekarang.", allowed)).toBe(false);
    expect(isAllowedNarration(renderLine(CLASSIC_LINES.DAWN_MULTI_KILL, { victimList: joinNames(["Budi", "Mallory"]) }), allowed)).toBe(false);
    expect(isAllowedNarration(`${CLASSIC_LINES.DAWN_NO_KILL} Tambahan.`, allowed)).toBe(false);
    expect(isAllowedNarration("", allowed)).toBe(false);
  });
});
