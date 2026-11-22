import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

/**
 * Microsoft Edge Neural TTS via node-edge-tts (the Edge "Read Aloud" online service).
 * Not an official public API: it can change without notice, so callers keep a Web Speech fallback.
 * Every rendered line is cached on disk, so a given voice + text is synthesized only once.
 */

export const EDGE_VOICES = ["id-ID-GadisNeural", "id-ID-ArdiNeural"] as const;
export type EdgeVoice = (typeof EDGE_VOICES)[number];

export function defaultVoice(): EdgeVoice {
  const configured = process.env.TTS_VOICE;
  return (EDGE_VOICES as readonly string[]).includes(configured ?? "") ? configured as EdgeVoice : "id-ID-GadisNeural";
}

function cacheDir() {
  return process.env.TTS_CACHE_DIR || path.join(os.tmpdir(), "partyquest-tts");
}

const inFlight = new Map<string, Promise<Buffer>>();

async function synthesize(text: string, voice: EdgeVoice) {
  const tts = new EdgeTTS({ voice, lang: "id-ID", outputFormat: "audio-24khz-48kbitrate-mono-mp3", timeout: 15_000 });
  const chunks: Buffer[] = [];
  for await (const part of tts.streamAudio(text)) if (Buffer.isBuffer(part)) chunks.push(part);
  const audio = Buffer.concat(chunks);
  if (audio.length === 0) throw new Error("tts_empty");
  return audio;
}

export async function edgeSpeech(text: string, voice: EdgeVoice = defaultVoice()): Promise<Buffer> {
  const key = createHash("sha256").update(`${voice}\n${text}`).digest("hex");
  const file = path.join(cacheDir(), voice, `${key}.mp3`);
  try {
    return await readFile(file);
  } catch {
    // Cache miss: synthesize below.
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const audio = await synthesize(text, voice);
    await mkdir(path.dirname(file), { recursive: true });
    // Write then rename so a concurrent reader never sees a partial file.
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, audio);
    await rename(temp, file);
    return audio;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}
