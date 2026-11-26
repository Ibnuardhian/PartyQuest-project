"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Gap between two taps or actions, long enough to stop button mashing without feeling stuck. */
export const TAP_COOLDOWN_MS = 500;

/**
 * A short lock after each use: `cooling` is true for `ms` after `start()`, so a button can be disabled and
 * a quick second click is ignored. Cleans its timer up on unmount.
 */
export function useCooldown(ms = TAP_COOLDOWN_MS) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const start = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setCooling(true);
    timer.current = window.setTimeout(() => setCooling(false), ms);
  }, [ms]);
  return { cooling, start };
}
