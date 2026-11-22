// Splits a narrator line into Indonesian text and English role names, so each part can be
// spoken with the right pronunciation and then joined into one MP3.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns segments in order: { lang: "id" | "en", text } for speech, or { pause: seconds } for
 * punctuation-only gaps (Edge cannot voice a bare "...").
 */
export function splitBilingual(text, englishTerms) {
  if (englishTerms.length === 0) return [{ lang: "id", text }];
  const pattern = new RegExp(`\\b(${[...englishTerms].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})\\b`, "g");
  const segments = [];
  let last = 0;
  const pushIndonesian = (chunk) => {
    let rest = chunk;
    // Leading punctuation right after an English word becomes a pause ("Werewolf... buka mata").
    const lead = rest.match(/^\s*([.…!?,;:]+)\s*/);
    if (lead) {
      segments.push({ pause: pauseFor(lead[1]) });
      rest = rest.slice(lead[0].length);
    }
    if (/\p{L}/u.test(rest)) segments.push({ lang: "id", text: rest.trim() });
    else if (/[.…!?,;:]/.test(rest)) segments.push({ pause: pauseFor(rest.trim()) });
  };
  for (const match of text.matchAll(pattern)) {
    pushIndonesian(text.slice(last, match.index));
    segments.push({ lang: "en", text: match[0] });
    last = match.index + match[0].length;
  }
  pushIndonesian(text.slice(last));
  return segments.filter((segment) => segment.pause === undefined || segment.pause > 0);
}

function pauseFor(punctuation) {
  if (/\.\.\.|…/.test(punctuation)) return 0.45;
  if (/[.!?]/.test(punctuation)) return 0.3;
  if (/[,;:]/.test(punctuation)) return 0.15;
  return 0;
}
