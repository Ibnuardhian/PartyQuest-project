import type { ClassicRole, OnuwRole, WinnerFaction } from "@/games/werewolf/contract";
import pack from "@/games/werewolf/voice/voice-pack.json";

/**
 * Werewolf narrator lines.
 * - Static lines come from the voice pack (werewolf-tts-voice-pack.zip): 41 MP3 files generated
 *   once with Microsoft Edge Neural TTS (scripts/generate-werewolf-voice.mjs) and served from public/.
 * - Four daytime announcements name the players involved. They are rendered on demand by the
 *   server's Microsoft Edge TTS route; the pack's generic clip is the fallback.
 * Night turns name roles only: naming the player would reveal who holds the role.
 */

/** A line to speak: a static clip, or dynamic text with an optional static fallback clip. */
export interface VoiceLine { text: string; clip?: string; fallbackClip?: string }

type PackItem = (typeof pack.items)[number];
const PACK = new Map<string, PackItem>(pack.items.map((item) => [item.key, item]));

export type VoicePresetId = keyof typeof pack.presets;
export const VOICE_PRESETS = pack.presets as Record<VoicePresetId, { label: string; rate: string; pitch: string }>;
export const ACTIVE_PRESET = pack.activePreset as VoicePresetId;
export const VOICE_PACK = {
  voice: pack.voice,
  preset: ACTIVE_PRESET,
  ...VOICE_PRESETS[ACTIVE_PRESET],
  dramaticEffects: pack.dramaticEffects,
  bilingual: { strategy: pack.bilingual.strategy, englishVoice: pack.bilingual.englishVoice, multilingualVoice: pack.bilingual.multilingualVoice, sampleKeys: pack.bilingual.sampleKeys },
  items: pack.items,
};

export function isVoicePreset(value: unknown): value is VoicePresetId {
  return typeof value === "string" && Object.hasOwn(VOICE_PRESETS, value);
}

const PACK_TEXTS = new Set(pack.items.map((item) => item.text));
/** True for the exact text of a static voice-pack line. */
export function isPackText(text: string) {
  return PACK_TEXTS.has(text);
}

export function packLine(key: string): VoiceLine {
  const item = PACK.get(key);
  if (!item) throw new Error(`Baris suara "${key}" tidak ada di voice pack.`);
  return { text: item.text, clip: item.file };
}

/** Daytime announcements that name players (subtitle wording from the voice pack spec). */
export const NAME_LINES = {
  DAWN_SINGLE_KILL: { template: "Pagi telah tiba! Warga desa terbangun dengan kabar duka... {victimName} ditemukan tewas semalam.", fallback: "CLASSIC_DAWN_SINGLE_KILL" },
  DAWN_MULTI_KILL: { template: "Pagi telah tiba! Tragedi berdarah terjadi semalam... {victimList} ditemukan tewas!", fallback: "CLASSIC_DAWN_MULTI_KILL" },
  HUNTER_REVENGE: { template: "Sang Pemburu, {hunterName}, gugur, namun ia sempat menarik pelatuk senjatanya! {hunterName}... pilih satu targetmu di layar sekarang!", fallback: "CLASSIC_HUNTER_REVENGE" },
  EXECUTION_RESULT: { template: "Warga desa telah memutuskan... {executedName} dieksekusi hari ini!", fallback: "CLASSIC_EXECUTION_RESULT" },
} as const;
export type NameLineKey = keyof typeof NAME_LINES;

export const NAME_VARIABLES = ["victimName", "victimList", "hunterName", "executedName"] as const;
export type TemplateVars = Partial<Record<(typeof NAME_VARIABLES)[number], string>>;

/** Fills {placeholders}; throws if one is missing or not allowed, so a broken line is never spoken. */
export function renderLine(template: string, vars: TemplateVars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(NAME_VARIABLES as readonly string[]).includes(name)) throw new Error(`Variabel suara "${name}" tidak diizinkan.`);
    const value = vars[name as keyof TemplateVars];
    if (!value) throw new Error(`Variabel suara "${name}" belum diisi.`);
    return value;
  });
}

export function nameLine(key: NameLineKey, vars: TemplateVars): VoiceLine {
  const line = NAME_LINES[key];
  return { text: renderLine(line.template, vars), fallbackClip: packLine(line.fallback).clip };
}

/** Joins names the way Indonesian speech does: "A, B, dan C". */
export function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")}, dan ${names.at(-1)}`;
}

// ---------- Classic ----------

const TURN_KEYS: Partial<Record<ClassicRole, string>> = {
  CUPID: "CLASSIC_TURN_CUPID", MASON: "CLASSIC_TURN_MASON", WEREWOLF: "CLASSIC_TURN_WEREWOLF",
  DOCTOR: "CLASSIC_TURN_DOCTOR", SEER: "CLASSIC_TURN_SEER", WITCH: "CLASSIC_TURN_WITCH",
};
const WIN_KEYS: Record<WinnerFaction, string> = {
  VILLAGER: "CLASSIC_WIN_VILLAGER", WEREWOLF: "CLASSIC_WIN_WEREWOLF", TANNER: "CLASSIC_WIN_TANNER", LOVERS: "CLASSIC_WIN_LOVERS",
};

export const classicVoice = {
  nightIntro: () => packLine("CLASSIC_NIGHT_INTRO"),
  turnStart: (role: ClassicRole) => packLine(TURN_KEYS[role] ?? "CLASSIC_TURN_END"),
  turnEnd: () => packLine("CLASSIC_TURN_END"),
  dawnNoKill: () => packLine("CLASSIC_DAWN_NO_KILL"),
  dawnKills: (victims: readonly string[]): VoiceLine => victims.length === 1
    ? nameLine("DAWN_SINGLE_KILL", { victimName: victims[0]! })
    : nameLine("DAWN_MULTI_KILL", { victimList: joinNames(victims) }),
  hunter: (hunterName: string) => nameLine("HUNTER_REVENGE", { hunterName }),
  dayStart: () => packLine("CLASSIC_DAY_DISCUSSION_START"),
  dayOneMinuteLeft: () => packLine("CLASSIC_DAY_ONE_MINUTE_LEFT"),
  votingStart: () => packLine("CLASSIC_VOTING_START"),
  voteTie: () => packLine("CLASSIC_VOTING_TIE"),
  execution: (executedName: string) => nameLine("EXECUTION_RESULT", { executedName }),
  noExecution: () => packLine("CLASSIC_EXECUTION_NONE"),
  win: (faction: WinnerFaction) => packLine(WIN_KEYS[faction]),
};

// ---------- ONUW (voice-only night; open -> countdown -> close) ----------

export const onuwVoice = {
  intro: () => packLine("ONUW_ONUW_INTRO"),
  open: (role: OnuwRole) => packLine(`ONUW_${role}_OPEN`),
  close: (role: OnuwRole) => packLine(`ONUW_${role}_CLOSE`),
  dayStart: () => packLine("ONUW_ONUW_DAY_START"),
  voteCountdown: () => packLine("ONUW_ONUW_VOTE_COUNTDOWN"),
};
