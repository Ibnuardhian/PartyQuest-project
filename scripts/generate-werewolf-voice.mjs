// Generates the static Werewolf voice pack (41 MP3 lines) with Microsoft Edge Neural TTS.
// Usage (in Docker): docker compose run --rm --no-deps web npm run voice:generate [-- --force]
// Reads src/games/werewolf/voice/voice-pack.json and writes into public/audio/werewolf/.
// The Edge service rate-limits bursts (HTTP 429), so requests are spaced out and retried with backoff.
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

const root = path.resolve(import.meta.dirname, "..");
const pack = JSON.parse(await readFile(path.join(root, "src/games/werewolf/voice/voice-pack.json"), "utf8"));
const force = process.argv.includes("--force");
const voice = process.env.TTS_VOICE || pack.voice;
const SPACING_MS = 1500;
const RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = async (file) => ((await stat(file).catch(() => null))?.size ?? 0) > 0;

async function render(text, out) {
  const temp = `${out}.part`;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const tts = new EdgeTTS({ voice, lang: "id-ID", outputFormat: "audio-24khz-48kbitrate-mono-mp3", rate: pack.rate, pitch: pack.pitch, timeout: 20_000 });
      await tts.ttsPromise(text, temp);
      if (!(await exists(temp))) throw new Error("empty audio");
      await rename(temp, out);
      return;
    } catch (error) {
      await rm(temp, { force: true });
      if (attempt === RETRIES) throw error;
      const wait = 4000 * 2 ** (attempt - 1);
      console.log(`  retry ${attempt}/${RETRIES - 1} in ${wait / 1000}s (${error instanceof Error ? error.message : error})`);
      await sleep(wait);
    }
  }
}

let generated = 0;
let failed = 0;
for (const [index, item] of pack.items.entries()) {
  const out = path.join(root, "public", item.file);
  const label = `[${index + 1}/${pack.items.length}] ${item.file}`;
  if (!force && await exists(out)) {
    console.log(`${label} skip (exists)`);
    continue;
  }
  await mkdir(path.dirname(out), { recursive: true });
  try {
    await render(item.text, out);
    generated += 1;
    console.log(`${label} ok`);
  } catch (error) {
    failed += 1;
    console.error(`${label} FAILED: ${error instanceof Error ? error.message : error}`);
  }
  await sleep(SPACING_MS);
}
console.log(`done: ${generated} generated, ${failed} failed, voice ${voice} (rate ${pack.rate}, pitch ${pack.pitch})`);
if (failed > 0) process.exitCode = 1;
