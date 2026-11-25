// Writes each voice-pack line's spoken length ("seconds") into src/games/werewolf/voice/voice-pack.json.
// The online Werewolf timers add this to a turn's countdown, so the narrator finishes before the clock runs.
//
//   docker compose run --rm --no-deps web npm run voice:measure
//
// Needs ffprobe (present in the web image). The value is the longer of the Microsoft and ElevenLabs clips,
// rounded up to 0.1 s. Run it again after `npm run voice:generate`.
import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const packFile = path.join(root, "src/games/werewolf/voice/voice-pack.json");
const original = await readFile(packFile, "utf8");
const newline = original.includes("\r\n") ? "\r\n" : "\n";
const text = original.replaceAll("\r\n", "\n");
const pack = JSON.parse(text);

async function duration(file) {
  if (!(await stat(file).catch(() => null))) return 0;
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number.parseFloat(stdout.trim()) || 0;
}

const seconds = new Map();
for (const item of pack.items) {
  const relative = item.file.replace(/^\//, "");
  const microsoft = await duration(path.join(root, "public", relative));
  const elevenlabs = await duration(path.join(root, "public", relative.replace("audio/werewolf/", "audio/werewolf/elevenlabs/")));
  seconds.set(item.key, Math.ceil(Math.max(microsoft, elevenlabs) * 10) / 10);
}

const output = [];
let key = null;
for (const line of text.split("\n")) {
  const keyMatch = /^\s*"key": "([A-Z0-9_]+)",/.exec(line);
  if (keyMatch) key = keyMatch[1];
  if (/^\s*"seconds":/.test(line)) continue;
  output.push(line);
  if (key && /^\s*"file": ".*",\s*$/.test(line)) {
    output.push(`${/^\s*/.exec(line)[0]}"seconds": ${seconds.get(key)},`);
    key = null;
  }
}
const result = output.join("\n");
JSON.parse(result);
await writeFile(packFile, result.replaceAll("\n", newline));
const longest = [...seconds].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, value]) => `${name} ${value}s`).join(", ");
console.log(`done: ${seconds.size} lines measured. Longest: ${longest}`);
