"use client";

/**
 * Browser voice moderator (docs/03 §1.1, docs/04 §9). Microsoft Edge Neural audio comes first
 * (fetched from the server through a clip resolver); the Web Speech API is the fallback.
 * Only the designated audio device should create a Narrator; other phones stay silent.
 */

/** Returns an audio URL for a line, or null to fall back to browser speech. */
export type ClipResolver = (text: string) => Promise<string | null>;

/**
 * Resolver for the server's Microsoft Edge TTS routes. Caches each line as an object URL and
 * pauses for a minute after a service failure, so a broken service does not delay every line.
 */
export function microsoftClipResolver(endpoint: string, extraBody: Record<string, unknown> = {}): ClipResolver {
  const cache = new Map<string, Promise<string | null>>();
  let pausedUntil = 0;
  return (text) => {
    if (Date.now() < pausedUntil) return Promise.resolve(null);
    const cached = cache.get(text);
    if (cached) return cached;
    const request = (async () => {
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...extraBody, text }) });
        if (!response.ok) throw new Error(String(response.status));
        return URL.createObjectURL(await response.blob());
      } catch {
        pausedUntil = Date.now() + 60_000;
        cache.delete(text);
        return null;
      }
    })();
    cache.set(text, request);
    return request;
  };
}

export interface NarratorOptions {
  voiceURI?: string | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Voices load asynchronously in Chrome; wait for them briefly. */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);
  const current = window.speechSynthesis.getVoices();
  if (current.length > 0) return Promise.resolve(current);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      window.clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    const timer = window.setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

export function indonesianVoices(voices: SpeechSynthesisVoice[]) {
  return voices
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("id"))
    // Prefer higher-quality online/natural voices when the browser offers them.
    .sort((a, b) => Number(/natural|online|google/i.test(b.name)) - Number(/natural|online|google/i.test(a.name)));
}

/** Chrome may stop long utterances after ~15 s, so speak sentence by sentence. */
export function splitSentences(text: string) {
  return text.match(/[^.!?…]+(?:\.{3}|[.!?…])*\s*/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

export class Narrator {
  private options: NarratorOptions;
  private generation = 0;
  private resolveClip: ClipResolver | null = null;
  private audio: HTMLAudioElement | null = null;
  /** "microsoft" when the last line played from Edge Neural audio, "browser" for Web Speech. */
  lastEngine: "microsoft" | "browser" | null = null;

  setClipResolver(resolver: ClipResolver | null) {
    this.resolveClip = resolver;
  }

  constructor(options: NarratorOptions = {}) {
    this.options = options;
  }

  setOptions(options: NarratorOptions) {
    this.options = { ...this.options, ...options };
  }

  /** Call from a tap ("Aktifkan Suara") so mobile browsers allow later speech. */
  unlock() {
    // Mobile browsers only allow audio started from a tap; prime one reusable element now.
    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      this.audio ??= new Audio();
      this.audio.muted = true;
      void this.audio.play().catch(() => {}).finally(() => { if (this.audio) this.audio.muted = false; });
    }
    if (!isSpeechSupported()) return;
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }

  cancel() {
    this.generation += 1;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
    }
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  }

  private playClip(url: string, generation: number) {
    return new Promise<boolean>((resolve) => {
      this.audio ??= new Audio();
      const audio = this.audio;
      const done = (ok: boolean) => { audio.onended = null; audio.onerror = null; resolve(ok && generation === this.generation); };
      audio.onended = () => done(true);
      audio.onerror = () => done(false);
      audio.src = url;
      audio.volume = this.options.volume ?? 1;
      audio.playbackRate = this.options.rate ?? 1;
      void audio.play().catch(() => done(false));
    });
  }

  get speaking() {
    return isSpeechSupported() && window.speechSynthesis.speaking;
  }

  /** Speaks the text; resolves when finished or cancelled. Returns false when cancelled. */
  async speak(text: string): Promise<boolean> {
    const generation = this.generation;
    const clip = this.resolveClip ? await this.resolveClip(text) : null;
    if (generation !== this.generation) return false;
    if (clip && await this.playClip(clip, generation)) {
      this.lastEngine = "microsoft";
      return true;
    }
    if (generation !== this.generation || !isSpeechSupported()) return false;
    this.lastEngine = "browser";
    const voice = this.options.voiceURI ? window.speechSynthesis.getVoices().find((item) => item.voiceURI === this.options.voiceURI) : undefined;
    for (const sentence of splitSentences(text)) {
      if (generation !== this.generation) return false;
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = voice?.lang ?? "id-ID";
        if (voice) utterance.voice = voice;
        utterance.rate = this.options.rate ?? 1;
        utterance.pitch = this.options.pitch ?? 1;
        utterance.volume = this.options.volume ?? 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
    return generation === this.generation;
  }
}

/** Keeps the screen on during play when supported. Returns a release function. */
export async function requestWakeLock(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    const lock = await nav.wakeLock?.request("screen");
    return () => { void lock?.release().catch(() => {}); };
  } catch {
    return () => {};
  }
}
