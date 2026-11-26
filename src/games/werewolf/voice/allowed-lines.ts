import { NAME_LINES } from "@/games/werewolf/voice/templates";

/**
 * Server-side guard for the TTS routes: only the named announcement templates, filled with
 * allowed player names, may be sent to the speech service. Static lines are pre-generated MP3
 * files and never go through the server. This keeps the routes from being a general TTS proxy.
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

const PATTERNS = Object.values(NAME_LINES).map((line) => compile(line.template));

/** True when the value is a player name the speaker may say. */
export type PlayerNameCheck = (value: string) => boolean;

function valueAllowed(name: string, value: string, isPlayerName: PlayerNameCheck) {
  switch (name) {
    case "victimName":
    case "hunterName":
    case "executedName":
    case "princeName":
    case "troublemakerName":
    case "silencedName":
    case "doomedName": return isPlayerName(value);
    case "victimList": return value.split(/, dan |, /).every((part) => isPlayerName(part));
    default: return false;
  }
}

export function isAllowedNarration(text: string, isPlayerName: PlayerNameCheck) {
  if (text.length === 0 || text.length > 400) return false;
  return PATTERNS.some(({ regex, vars }) => {
    const match = regex.exec(text);
    if (!match) return false;
    const seen = new Map<string, string>();
    return vars.every((name, index) => {
      const value = match[index + 1]!;
      // A placeholder used twice (the Hunter's name) must carry the same value.
      if (seen.has(name) && seen.get(name) !== value) return false;
      seen.set(name, value);
      return valueAllowed(name, value, isPlayerName);
    });
  });
}
