"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadVoiceConfig, microsoftClipResolver, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { classicVoice, VOICE_PACK, type VoiceLine } from "@/games/werewolf/voice/templates";
import { applyVoiceChoice, loadVoiceChoice } from "@/games/werewolf/voice/voice-choice";
import { narrationKey, narrationLines, type NarrationKey } from "@/games/werewolf/ui/narration";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

/**
 * Voice moderator for the single audio device (docs/03 §1.1): the paired TV when one is connected,
 * otherwise the host's phone. Every other device stays silent.
 */
export function useNarration(publicView: WerewolfView["public"] | null, sessionId: string | null, isAudioDevice: boolean, secondsLeft: number | null = null) {
  const narrator = useMemo(() => new Narrator({ rate: 1 }), []);
  const [enabled, setEnabled] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const previous = useRef<NarrationKey | null>(null);
  const warnedDay = useRef<number | null>(null);

  async function play(lines: VoiceLine[]) {
    for (const line of lines) {
      setSubtitle(line.text);
      if (!(await narrator.speak(line))) return;
    }
    setSubtitle("");
  }

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    // Named lines (Microsoft choice) are voiced by the server with Microsoft Edge Neural.
    narrator.setClipResolver(microsoftClipResolver("/api/games/werewolf/tts", { sessionId, provider: "microsoft" }));
    narrator.setEffects(VOICE_PACK.dramaticEffects);
    void loadVoiceConfig().then((config) => {
      if (cancelled) return;
      // The voice this device saved on /games/werewolf/suara, else the server default.
      applyVoiceChoice(narrator, loadVoiceChoice(config));
    });
    return () => { cancelled = true; narrator.cancel(); };
  }, [narrator, sessionId]);

  useEffect(() => {
    if (!publicView) return;
    const lines = narrationLines(previous.current, publicView);
    previous.current = narrationKey(publicView);
    if (!enabled || !isAudioDevice || lines.length === 0) return;
    void play(lines);
    // play() only touches refs/state setters and the narrator, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicView, enabled, isAudioDevice, narrator]);

  // "Satu menit lagi" once per day, when the discussion countdown passes 60 seconds.
  const day = publicView?.phase === "DAY_DISCUSSION" ? publicView.dayNumber : null;
  useEffect(() => {
    if (day === null || secondsLeft === null || secondsLeft > 60 || secondsLeft <= 5 || warnedDay.current === day) return;
    warnedDay.current = day;
    if (!enabled || !isAudioDevice) return;
    const timer = window.setTimeout(() => void play([classicVoice.dayOneMinuteLeft()]), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, secondsLeft, enabled, isAudioDevice]);

  // Hand the voice over cleanly when a TV connects or disconnects.
  useEffect(() => { if (!isAudioDevice) narrator.cancel(); }, [isAudioDevice, narrator]);

  async function enable() {
    narrator.unlock();
    setEnabled(true);
    await requestWakeLock();
  }

  function disable() {
    narrator.cancel();
    setEnabled(false);
  }

  return { isAudioDevice, enabled, enable, disable, subtitle };
}
