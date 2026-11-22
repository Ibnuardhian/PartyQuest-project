import type { OnuwRole } from "@/games/werewolf/contract";

/**
 * Deterministic Indonesian voice lines (docs/03 §1.2). No LLM; only variable interpolation.
 * The narrator never speaks player names, only role names; names appear on screen.
 * Every variable comes from a small finite set (night ordinal, role name, count, minutes),
 * so every line can also be pre-rendered to audio files.
 * ONUW role lines are split into an "open" part and a "close" part around the countdown.
 */

export const CLASSIC_LINES = {
  NIGHT_INTRO: "Malam {nightOrdinal} telah tiba. Seluruh warga desa menunduk dan perhatikan layar masing-masing. Tetap tenang dan jangan bersuara.",
  NIGHT_TURN_START: "Giliran {roleName} beraksi. Silakan tentukan pilihanmu di layar sekarang.",
  NIGHT_TURN_END: "Waktu untuk {roleName} telah selesai.",
  DAWN_SINGLE_KILL: "Pagi telah tiba! Warga desa terbangun dengan kabar duka... satu warga ditemukan tewas semalam. Lihat layar untuk mengetahui siapa korbannya.",
  DAWN_MULTI_KILL: "Pagi telah tiba! Tragedi berdarah terjadi semalam... {victimCount} warga ditemukan tewas. Lihat layar untuk mengetahui siapa saja korbannya.",
  DAWN_NO_KILL: "Pagi telah tiba! Keajaiban terjadi semalam, tidak ada satu pun warga desa yang menjadi korban.",
  HUNTER_TRIGGER: "Sang Pemburu gugur, namun ia sempat menarik pelatuk senjatanya! Pemburu, pilih satu targetmu di layar sekarang.",
  DAY_START: "Fase diskusi dimulai. Kalian memiliki waktu {minutes} menit untuk berdebat dan mencari pelaku.",
  DAY_1MIN_WARN: "Waktu diskusi tersisa satu menit lagi.",
  VOTING_START: "Waktu diskusi habis! Silakan pilih satu nama di layar HP kalian untuk dieksekusi.",
  VOTE_TIE: "Hasil voting seri! Para kandidat yang seri memiliki waktu tiga puluh detik untuk membela diri sebelum voting ulang.",
  EXECUTION_RESULT: "Warga desa telah memutuskan. Satu warga dieksekusi hari ini. Lihat layar untuk hasil voting.",
  NO_EXECUTION: "Voting kembali seri. Tidak ada warga yang dieksekusi hari ini.",
  GAME_OVER: "Permainan berakhir! Kemenangan diraih oleh kubu {winningFaction}!",
} as const;
export type ClassicLineKey = keyof typeof CLASSIC_LINES;

export const ONUW_LINES = {
  ONUW_START: "Semua pemain tutup mata. Pastikan HP berada di tengah meja dan jangan menyentuh layar.",
  ONUW_DAY: "Semua pemain, buka mata! Pagi telah tiba. Kalian punya waktu {minutes} menit untuk berdiskusi.",
  ONUW_VOTE: "Waktu habis! Hitungan mundur dimulai... Tiga... Dua... Satu... Tunjuk target kalian sekarang!",
} as const;
export type OnuwLineKey = keyof typeof ONUW_LINES;

export const ONUW_ROLE_LINES: Partial<Record<OnuwRole, { open: string; close: string }>> = {
  WEREWOLF: { open: "Werewolf, buka mata dan kenali sesama Werewolf. Jika sendirian, lihat satu kartu tengah.", close: "Werewolf, tutup mata." },
  MINION: { open: "Minion, buka mata. Werewolf, acungkan jempol kalian agar Minion mengenali kalian.", close: "Werewolf turunkan jempol, Minion tutup mata." },
  MASON: { open: "Mason, buka mata dan kenali sesama rekan Mason kalian.", close: "Mason, tutup mata." },
  SEER: { open: "Seer, buka mata. Lihat kartu milik satu pemain lain, atau dua kartu di tengah meja.", close: "Seer, tutup mata." },
  ROBBER: { open: "Robber, buka mata. Tukar kartumu dengan kartu satu pemain lain, lalu lihat kartu barumu.", close: "Robber, tutup mata." },
  TROUBLEMAKER: { open: "Troublemaker, buka mata. Tukar kartu milik dua pemain lain tanpa melihat isinya.", close: "Troublemaker, tutup mata." },
  DRUNK: { open: "Drunk, buka mata. Tukar kartumu dengan satu kartu di tengah meja tanpa melihatnya.", close: "Drunk, tutup mata." },
  INSOMNIAC: { open: "Insomniac, buka mata dan periksa kartumu sendiri sekarang.", close: "Insomniac, tutup mata." },
};

const ORDINALS = ["pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh",
  "kesebelas", "kedua belas", "ketiga belas", "keempat belas", "kelima belas", "keenam belas", "ketujuh belas", "kedelapan belas", "kesembilan belas", "kedua puluh"];

/** "Malam ke-1" reads awkwardly in TTS, so nights are spoken as words. */
export function nightOrdinal(night: number) {
  return ORDINALS[night - 1] ?? `ke-${night}`;
}

const NUMBER_WORDS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh",
  "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas"];

/** Small counts spoken as words ("dua warga"), matching pre-rendered audio. */
export function countWords(count: number) {
  return NUMBER_WORDS[count] ?? String(count);
}

/** Placeholders a line may use. Player names are deliberately not among them. */
export const ALLOWED_VARIABLES = ["nightOrdinal", "roleName", "victimCount", "minutes", "winningFaction"] as const;

export type TemplateVars = Record<string, string | number>;

/** Fills {placeholders}; throws if one is missing or not allowed, so a broken line is never spoken. */
export function renderLine(template: string, vars: TemplateVars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(ALLOWED_VARIABLES as readonly string[]).includes(name)) throw new Error(`Variabel suara "${name}" tidak diizinkan.`);
    const value = vars[name];
    if (value === undefined || value === "") throw new Error(`Variabel suara "${name}" belum diisi.`);
    return String(value);
  });
}
