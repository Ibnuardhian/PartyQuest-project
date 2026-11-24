import { describe, expect, it } from "vitest";
import { splitBilingual, splitBreaks } from "./voice-segments.mjs";

describe("splitBreaks", () => {
  it("turns break markers into pauses between spoken parts", () => {
    expect(splitBreaks('Tutup mata. <break time="1000ms"/> Buka mata. <break time="0.8s"/> Pagi!')).toEqual([
      { text: "Tutup mata." }, { pause: 1 }, { text: "Buka mata." }, { pause: 0.8 }, { text: "Pagi!" },
    ]);
  });

  it("leaves lines without markers as one part", () => {
    expect(splitBreaks("Pagi telah tiba.")).toEqual([{ text: "Pagi telah tiba." }]);
  });
});

const TERMS = ["Seer", "Werewolf", "Hunter", "Troublemaker", "Lovers"];

describe("splitBilingual", () => {
  it("separates English role names from Indonesian text", () => {
    expect(splitBilingual("Giliran Seer beraksi... Pilih satu pemain.", TERMS)).toEqual([
      { lang: "id", text: "Giliran" },
      { lang: "en", text: "Seer" },
      { lang: "id", text: "beraksi... Pilih satu pemain." },
    ]);
  });

  it("turns punctuation next to a role name into a pause and handles repeats", () => {
    expect(splitBilingual("Werewolf... buka mata dan kenali sesama Werewolf. Jika sendirian, lihat kartu.", TERMS)).toEqual([
      { lang: "en", text: "Werewolf" },
      { pause: 0.45 },
      { lang: "id", text: "buka mata dan kenali sesama" },
      { lang: "en", text: "Werewolf" },
      { pause: 0.3 },
      { lang: "id", text: "Jika sendirian, lihat kartu." },
    ]);
  });

  it("leaves lines without role names untouched and matches whole words only", () => {
    expect(splitBilingual("Voting kembali seri.", TERMS)).toEqual([{ lang: "id", text: "Voting kembali seri." }]);
    expect(splitBilingual("Seerah", TERMS)).toEqual([{ lang: "id", text: "Seerah" }]);
    expect(splitBilingual("Pasangan Lovers bertahan hidup!", TERMS)).toEqual([
      { lang: "id", text: "Pasangan" }, { lang: "en", text: "Lovers" }, { lang: "id", text: "bertahan hidup!" },
    ]);
  });
});
