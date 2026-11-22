import { CLASSIC_LINES, NUMBER_WORDS, ONUW_LINES, ONUW_ROLE_LINES, ORDINALS } from "@/games/werewolf/voice/templates";

/**
 * Server-side guard for the TTS endpoint: only text that is exactly one of the narrator templates,
 * filled with allowed values, may be sent to the speech service. This keeps the endpoint from
 * becoming a general text-to-speech proxy.
 */

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Pattern { regex: RegExp; vars: string[] }

function compile(template: string): Pattern {
  const vars: string[] = [];
  let pattern = "";
  let last = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    pattern += escapeRegex(template.slice(last, match.index));
    pattern += "(.+?)";
    vars.push(match[1]!);
    last = match.index! + match[0].length;
  }
  pattern += escapeRegex(template.slice(last));
  return { regex: new RegExp(`^${pattern}$`, "u"), vars };
}

const ALL_TEMPLATES = [
  ...Object.values(CLASSIC_LINES),
  ...Object.values(ONUW_LINES),
  ...Object.values(ONUW_ROLE_LINES).flatMap((line) => line ? [line.open, line.close] : []),
];
const PATTERNS = ALL_TEMPLATES.map(compile);

export interface AllowedValues {
  roleNames: readonly string[];
  factionNames: readonly string[];
  /** True when the value is a player name the speaker may say. */
  isPlayerName: (value: string) => boolean;
}

function valueAllowed(name: string, value: string, allowed: AllowedValues) {
  switch (name) {
    case "nightOrdinal": return ORDINALS.includes(value) || /^ke-\d{1,3}$/.test(value);
    case "roleName": return allowed.roleNames.includes(value);
    case "minutes": return NUMBER_WORDS.includes(value) || /^\d{1,2}$/.test(value);
    case "winningFaction": return allowed.factionNames.includes(value);
    case "victimName":
    case "hunterName":
    case "executedName": return allowed.isPlayerName(value);
    case "victimList": return value.split(/, dan |, /).every((part) => allowed.isPlayerName(part));
    default: return false;
  }
}

export function isAllowedNarration(text: string, allowed: AllowedValues) {
  if (text.length === 0 || text.length > 400) return false;
  return PATTERNS.some(({ regex, vars }) => {
    const match = regex.exec(text);
    if (!match) return false;
    const seen = new Map<string, string>();
    return vars.every((name, index) => {
      const value = match[index + 1]!;
      // A placeholder used twice (e.g. the Hunter's name) must carry the same value.
      if (seen.has(name) && seen.get(name) !== value) return false;
      seen.set(name, value);
      return valueAllowed(name, value, allowed);
    });
  });
}
