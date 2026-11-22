import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Shared disk cache for synthesized speech: each provider + settings + text is produced once. */

function cacheDir() {
  return process.env.TTS_CACHE_DIR || path.join(os.tmpdir(), "partyquest-tts");
}

const inFlight = new Map<string, Promise<Buffer>>();

export async function cachedAudio(namespace: string, parts: readonly string[], produce: () => Promise<Buffer>): Promise<Buffer> {
  const key = createHash("sha256").update([namespace, ...parts].join("\n")).digest("hex");
  const file = path.join(cacheDir(), namespace, `${key}.mp3`);
  try {
    return await readFile(file);
  } catch {
    // Cache miss: produce below.
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const audio = await produce();
    if (audio.length === 0) throw new Error("tts_empty");
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
