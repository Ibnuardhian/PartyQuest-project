"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { microsoftClipResolver, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { narrationKey, narrationLines, type NarrationKey } from "@/games/werewolf/ui/narration";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

/**
 * Voice moderator for the designated audio device. Until a TV can be paired (Phase 7),
 * that is the host's phone; every other phone stays silent (single-source audio rule).
 */
export function useNarration(view: WerewolfView | null, sessionId: string) {
  const narrator = useMemo(() => new Narrator({ rate: 1 }), []);
  const [enabled, setEnabled] = useState(false);
  const previous = useRef<NarrationKey | null>(null);
  const isAudioDevice = Boolean(view?.you.isHost);

  useEffect(() => {
    // Microsoft Edge Neural voice first; Web Speech if the service is unavailable.
    narrator.setClipResolver(microsoftClipResolver("/api/games/werewolf/tts", { sessionId }));
    return () => narrator.cancel();
  }, [narrator, sessionId]);

  useEffect(() => {
    if (!view) return;
    const lines = narrationLines(previous.current, view.public);
    previous.current = narrationKey(view.public);
    if (!enabled || !isAudioDevice || lines.length === 0) return;
    void (async () => {
      for (const line of lines) if (!(await narrator.speak(line))) return;
    })();
  }, [view, enabled, isAudioDevice, narrator]);

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
