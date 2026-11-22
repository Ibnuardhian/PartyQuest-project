"use client";

/**
 * Browser voice moderator (docs/03 §1.1, docs/04 §9). Plays the static Microsoft Edge Neural
 * voice pack, asks the server for Microsoft audio of lines that name players, and falls back
 * to the Web Speech API. Only the designated audio device should create a Narrator.
 */

import type { VoiceLine } from "@/games/werewolf/voice/templates";

const DEFAULT_STATIC_BASE = "/audio/werewolf/";

/** Public narrator settings from GET /api/games/werewolf/voice-config. */
export interface VoiceConfig { provider: "microsoft" | "elevenlabs"; namedLines: "tts" | "generic"; staticBase: string; elevenLabsConfigured: boolean; elevenLabsPackReady: boolean; dramaticEffects: boolean }

export async function loadVoiceConfig(): Promise<VoiceConfig | null> {
  try {
    const response = await fetch("/api/games/werewolf/voice-config", { cache: "no-store" });
    const payload = await response.json() as { data?: VoiceConfig };
    return response.ok && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}

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
  private context: AudioContext | null = null;
  private fx: { wet: GainNode; bass: BiquadFilterNode } | null = null;
  private effects = false;

  /**
   * "Dramatic" narrator sound: heavier bass, a dark room reverb, and a compressor (Web Audio).
   * Applies to every clip (voice pack and Microsoft named lines); takes effect after unlock().
   */
  setEffects(enabled: boolean) {
    this.effects = enabled;
    this.applyEffects();
  }

  private applyEffects() {
    if (!this.fx || !this.context) return;
    const now = this.context.currentTime;
    this.fx.wet.gain.setTargetAtTime(this.effects ? 0.32 : 0, now, 0.05);
    this.fx.bass.gain.setTargetAtTime(this.effects ? 7 : 0, now, 0.05);
  }

  /** Built during the unlock tap, because browsers only start audio graphs from a user gesture. */
  private ensureEffectsGraph(audio: HTMLAudioElement) {
    if (this.fx || typeof AudioContext === "undefined") return;
    try {
      const context = this.context ?? new AudioContext();
      this.context = context;
      const source = context.createMediaElementSource(audio);
      const bass = context.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 220;
      bass.gain.value = 0;
      const dry = context.createGain();
      const wet = context.createGain();
      wet.gain.value = 0;
      const reverb = context.createConvolver();
      reverb.buffer = darkRoomImpulse(context, 2.6, 2.8);
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.ratio.value = 3;
      source.connect(bass);
      bass.connect(dry).connect(compressor);
      bass.connect(reverb).connect(wet).connect(compressor);
      compressor.connect(context.destination);
      this.fx = { wet, bass };
      this.applyEffects();
    } catch {
      this.fx = null;
    }
  }
  /** "microsoft" when the last line played from Edge Neural audio, "browser" for Web Speech. */
  lastEngine: "pack" | "microsoft" | "browser" | null = null;

  setClipResolver(resolver: ClipResolver | null) {
    this.resolveClip = resolver;
  }

  private staticBase = DEFAULT_STATIC_BASE;
  private namedLines: "tts" | "generic" = "tts";

  /** "generic" plays the nameless pack clip for named announcements instead of asking the server. */
  setNamedLines(mode: "tts" | "generic") {
    this.namedLines = mode;
  }

  /** Plays static clips from another pack folder (e.g. the ElevenLabs pack) with the same file names. */
  setStaticBase(base: string) {
    this.staticBase = base.endsWith("/") ? base : `${base}/`;
  }

  private mapClip(clip: string | undefined) {
    if (!clip || this.staticBase === DEFAULT_STATIC_BASE || !clip.startsWith(DEFAULT_STATIC_BASE)) return clip;
    return this.staticBase + clip.slice(DEFAULT_STATIC_BASE.length);
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
      this.ensureEffectsGraph(this.audio);
      void this.context?.resume().catch(() => {});
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

  /**
   * Speaks a line; resolves when finished or cancelled (false when cancelled).
   * Order: static voice-pack clip -> Microsoft TTS for named lines -> the pack's generic
   * fallback clip -> Web Speech.
   */
  async speak(input: VoiceLine | string): Promise<boolean> {
    const raw: VoiceLine = typeof input === "string" ? { text: input } : input;
    // In "generic" mode a named announcement becomes its nameless static clip.
    const source = this.namedLines === "generic" && !raw.clip && raw.fallbackClip ? { text: raw.text, clip: raw.fallbackClip } : raw;
    const line: VoiceLine = { text: source.text, clip: this.mapClip(source.clip), fallbackClip: this.mapClip(source.fallbackClip) };
    const text = line.text;
    const generation = this.generation;
    if (line.clip && await this.playClip(line.clip, generation)) {
      this.lastEngine = "pack";
      return true;
    }
    if (generation !== this.generation) return false;
    const clip = !line.clip && this.resolveClip ? await this.resolveClip(text) : null;
    if (generation !== this.generation) return false;
    if (clip && await this.playClip(clip, generation)) {
      this.lastEngine = "microsoft";
      return true;
    }
    if (generation !== this.generation) return false;
    if (line.fallbackClip && await this.playClip(line.fallbackClip, generation)) {
      this.lastEngine = "pack";
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

/** Synthetic impulse response: decaying noise that sounds like a large, dark stone room. */
function darkRoomImpulse(context: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay;
  }
  return buffer;
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
