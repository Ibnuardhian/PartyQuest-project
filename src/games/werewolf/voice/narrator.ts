"use client";

/**
 * Browser voice moderator using the Web Speech API (docs/03 §1.1, docs/04 §9).
 * Only the designated audio device should create a Narrator; other phones stay silent.
 */

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

  constructor(options: NarratorOptions = {}) {
    this.options = options;
  }

  setOptions(options: NarratorOptions) {
    this.options = { ...this.options, ...options };
  }

  /** Call from a tap ("Aktifkan Suara") so mobile browsers allow later speech. */
  unlock() {
    if (!isSpeechSupported()) return;
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }

  cancel() {
    this.generation += 1;
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  }

  get speaking() {
    return isSpeechSupported() && window.speechSynthesis.speaking;
  }

  /** Speaks the text; resolves when finished or cancelled. Returns false when cancelled. */
  async speak(text: string): Promise<boolean> {
    if (!isSpeechSupported()) return false;
    const generation = this.generation;
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
