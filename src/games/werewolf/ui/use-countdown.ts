"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left until a server deadline. `serverNow`/`receivedAt` correct for clock skew:
 * the countdown follows server time, so refreshing never restarts it.
 */
export function useCountdown(deadlineAt: string | null, serverNow: number, receivedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (!deadlineAt) return null;
  const skew = serverNow - receivedAt;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - (now + skew)) / 1000));
}

export function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
