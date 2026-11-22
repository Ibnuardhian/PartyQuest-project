"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadVoiceConfig, microsoftClipResolver, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { VOICE_PACK } from "@/games/werewolf/voice/templates";
import { narrationKey, narrationLines, type NarrationKey } from "@/games/werewolf/ui/narration";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

/**
 * Voice moderator for the single audio device (docs/03 §1.1): the paired TV when one is connected,
 * otherwise the host's phone. Every other device stays silent.
 */
export function useNarration(publicView: WerewolfView["public"] | null, sessionId: string | null, isAudioDevice: boolean) {
  const narrator = useMemo(() => new Narrator({ rate: 1 }), []);
  const [enabled, setEnabled] = useState(false);
  const previous = useRef<NarrationKey | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    // Named lines come from the server (ElevenLabs when configured, else Microsoft Edge Neural).
    narrator.setClipResolver(microsoftClipResolver("/api/games/werewolf/tts", { sessionId }));
    narrator.setEffects(VOICE_PACK.dramaticEffects);
    void loadVoiceConfig().then((config) => {
      if (cancelled || !config) return;
      narrator.setStaticBase(config.staticBase);
      narrator.setNamedLines(config.namedLines);
      narrator.setEffects(config.dramaticEffects);
    });
    return () => { cancelled = true; narrator.cancel(); };
  }, [narrator, sessionId]);

  useEffect(() => {
    if (!publicView) return;
    const lines = narrationLines(previous.current, publicView);
    previous.current = narrationKey(publicView);
    if (!enabled || !isAudioDevice || lines.length === 0) return;
    void (async () => {
      for (const line of lines) if (!(await narrator.speak(line))) return;
    })();
  }, [publicView, enabled, isAudioDevice, narrator]);

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

  return { isAudioDevice, enabled, enable, disable };
}
