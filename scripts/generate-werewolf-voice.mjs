// Generates the static Werewolf voice pack (52 MP3 lines) from src/games/werewolf/voice/voice-pack.json.
//
//   docker compose run --rm --no-deps web npm run voice:generate                         # Microsoft Edge Neural
//   docker compose run --rm --no-deps web npm run voice:generate -- --provider elevenlabs # ElevenLabs (needs ELEVENLABS_API_KEY)
//
// Options:
//   --force                 overwrite existing files
//   --only KEY1,KEY2        subset of item keys
//   --bilingual <strategy>  Microsoft only: off | segments | multilingual (default: bilingual.strategy in the JSON)
//                           segments = Indonesian by Ardi + English role names by an English voice, joined into one MP3 (needs ffmpeg)
//   --samples               write the comparison lines (bilingual.sampleKeys) to public/audio/werewolf/samples/<strategy>/
// Microsoft output: public/audio/werewolf/<mode>/<file>; ElevenLabs output: public/audio/werewolf/elevenlabs/<mode>/<file>.
// Both services rate-limit bursts, so requests are spaced out and retried with backoff.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { EdgeTTS } from "node-edge-tts";
import { splitBilingual, splitBreaks } from "./lib/voice-segments.mjs";

const run = promisify(execFile);

const root = path.resolve(import.meta.dirname, "..");
const pack = JSON.parse(await readFile(path.join(root, "src/games/werewolf/voice/voice-pack.json"), "utf8"));
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const force = args.includes("--force");
const provider = option("--provider") ?? "microsoft";
const samples = args.includes("--samples");
// Optional overrides for comparison samples: another multilingual voice and its own sample folder.
const multilingualVoice = option("--multilingual-voice") ?? pack.bilingual.multilingualVoice;
const sampleName = option("--sample-name");
const bilingual = option("--bilingual") ?? pack.bilingual.strategy;
if (!Object.hasOwn(pack.bilingual.strategies, bilingual)) throw new Error(`Unknown --bilingual "${bilingual}" (use ${Object.keys(pack.bilingual.strategies).join(", ")}).`);
const only = option("--only")?.split(",").map((key) => key.trim()).filter(Boolean) ?? (samples ? pack.bilingual.sampleKeys : undefined);
const SPACING_MS = 1500;
const RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = async (file) => ((await stat(file).catch(() => null))?.size ?? 0) > 0;

let render;
let outputBase;
let describe;
// Text per item: Microsoft reads the plain text; ElevenLabs may read an emotional variant.
let textFor = (item) => item.text;
if (provider === "microsoft") {
  const voice = process.env.TTS_VOICE || pack.voice;
  const presetId = process.env.TTS_PRESET || pack.activePreset;
  const preset = pack.presets[presetId];
  if (!preset) throw new Error(`Unknown preset "${presetId}". Choose one of: ${Object.keys(pack.presets).join(", ")}`);
  outputBase = path.join(root, samples ? `public/audio/werewolf/samples/${sampleName ?? bilingual}` : "public/audio/werewolf");
  const speaker = bilingual === "multilingual" ? multilingualVoice : bilingual === "segments" ? `${voice} + ${pack.bilingual.englishVoice}` : voice;
  describe = `Microsoft ${speaker}, preset ${presetId} (rate ${preset.rate}, pitch ${preset.pitch}), bilingual ${bilingual}`;
  const edge = async (speaker, lang, text, file) => {
    const tts = new EdgeTTS({ voice: speaker, lang, outputFormat: "audio-24khz-48kbitrate-mono-mp3", rate: preset.rate, pitch: preset.pitch, timeout: 20_000 });
    await tts.ttsPromise(text, file);
  };
  if (bilingual === "multilingual") {
    // One multilingual voice reads the whole line: English role names, Indonesian sentences.
    render = (text, file) => edge(multilingualVoice, "id-ID", text, file);
  } else if (bilingual === "segments") {
    render = async (text, file) => {
      const parts = splitBilingual(text, pack.bilingual.englishTerms);
      if (!parts.some((part) => part.lang === "en")) return edge(voice, "id-ID", text, file);
      await joinSegments(parts, file, (part, out) => part.lang === "en" ? edge(pack.bilingual.englishVoice, "en-US", part.text, out) : edge(voice, "id-ID", part.text, out));
    };
  } else {
    render = (text, file) => edge(voice, "id-ID", text, file);
  }
  // `edgeText` may carry <break time="..."/> pauses: speak each part, then join with exact silences.
  textFor = (item) => item.edgeText ?? item.text;
  const speakLine = render;
  render = async (text, file) => {
    const parts = splitBreaks(text);
    if (!parts.some((part) => part.pause !== undefined)) return speakLine(parts[0]?.text ?? text, file);
    await joinSegments(parts, file, (part, out) => speakLine(part.text, out));
  };
} else if (provider === "elevenlabs") {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY belum diisi. Isi di file .env lalu jalankan ulang.");
    process.exit(1);
  }
  const settings = pack.elevenlabs;
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || settings.voiceId;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || settings.modelId;
  const baseUrl = (process.env.ELEVENLABS_BASE_URL?.trim() || "https://api.elevenlabs.io").replace(/\/$/, "");
  outputBase = path.join(root, samples ? `public/audio/werewolf/samples/${sampleName ?? "elevenlabs"}` : "public/audio/werewolf/elevenlabs");
  const tags = /^eleven_v[34]\b/.test(modelId);
  describe = `ElevenLabs voice ${voiceId}, model ${modelId}${tags ? " with emotion tags" : " (no audio tags on this model; tags removed)"}`;
  // Emotion tags ([sad], [laughs], ...) only on eleven_v3/v4; other models would read them aloud.
  textFor = (item) => {
    const text = item.elevenlabsText ?? item.text;
    return tags ? text : text.replace(/\[[^\]]{1,40}\]\s*/g, "").trim();
  };
  render = async (text, file) => {
    const response = await fetch(`${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${settings.outputFormat}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: settings.voiceSettings }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const reason = (await response.text().catch(() => "")).slice(0, 300);
      const error = new Error(`HTTP ${response.status} ${reason}`);
      // 400/401/402 (plan required)/403/422 will not improve with retries.
      error.fatal = [400, 401, 402, 403, 422].includes(response.status);
      throw error;
    }
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  };
} else {
  throw new Error(`Unknown provider "${provider}" (use microsoft or elevenlabs).`);
}

/**
 * Speaks each segment, trims the silence Edge adds around every clip, and joins everything into one
 * MP3 (24 kHz mono, same format as the pack). Pauses come from the punctuation between segments.
 */
async function joinSegments(parts, out, speak) {
  const work = await mkdtemp(path.join(os.tmpdir(), "pq-voice-"));
  try {
    const inputs = [];
    for (const [index, part] of parts.entries()) {
      if (part.pause !== undefined) {
        inputs.push(["-f", "lavfi", "-t", String(part.pause), "-i", "anullsrc=r=24000:cl=mono"]);
        continue;
      }
      const raw = path.join(work, `${index}.mp3`);
      const trimmed = path.join(work, `${index}.wav`);
      await speak(part, raw);
      const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse";
      await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", trim, "-ar", "24000", "-ac", "1", trimmed]);
      // A short breath between two spoken segments that have no punctuation between them.
      if (index > 0 && parts[index - 1].pause === undefined) inputs.push(["-f", "lavfi", "-t", "0.06", "-i", "anullsrc=r=24000:cl=mono"]);
      inputs.push(["-i", trimmed]);
    }
    inputs.push(["-f", "lavfi", "-t", "0.35", "-i", "anullsrc=r=24000:cl=mono"]);
    const filter = `${inputs.map((_, index) => `[${index}:a]`).join("")}concat=n=${inputs.length}:v=0:a=1[out]`;
    await run("ffmpeg", ["-v", "error", "-y", ...inputs.flat(), "-filter_complex", filter, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "48k", "-ar", "24000", "-ac", "1", "-f", "mp3", out]);
  } catch (error) {
    if (error?.code === "ENOENT") throw Object.assign(new Error("ffmpeg tidak ditemukan. Bangun ulang image dev: docker compose build web"), { fatal: true });
    throw error;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function renderWithRetry(text, out) {
  const temp = `${out}.part`;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      await render(text, temp);
      if (!(await exists(temp))) throw new Error("empty audio");
      await rename(temp, out);
      return;
    } catch (error) {
      await rm(temp, { force: true });
      if (error?.fatal || attempt === RETRIES) throw error;
      const wait = 4000 * 2 ** (attempt - 1);
      console.log(`  retry ${attempt}/${RETRIES - 1} in ${wait / 1000}s (${error instanceof Error ? error.message : error})`);
      await sleep(wait);
    }
  }
}

const items = only ? pack.items.filter((item) => only.includes(item.key)) : pack.items;
let generated = 0;
let failed = 0;
for (const [index, item] of items.entries()) {
  const out = path.join(outputBase, item.file.replace("/audio/werewolf/", ""));
  const label = `[${index + 1}/${items.length}] ${path.relative(root, out)}`;
  if (!force && await exists(out)) {
    console.log(`${label} skip (exists)`);
    continue;
  }
  await mkdir(path.dirname(out), { recursive: true });
  try {
    await renderWithRetry(textFor(item), out);
    generated += 1;
    console.log(`${label} ok`);
  } catch (error) {
    failed += 1;
    console.error(`${label} FAILED: ${error instanceof Error ? error.message : error}`);
    if (error?.fatal) break;
  }
  await sleep(SPACING_MS);
}
console.log(`done: ${generated} generated, ${failed} failed — ${describe}`);
if (failed > 0) process.exitCode = 1;
