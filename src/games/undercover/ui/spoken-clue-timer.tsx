"use client";

import { useEffect, useRef, useState } from "react";
import { CLUE_TURN_DURATION_MS, formatClueSeconds } from "@/games/undercover/contract";

const DEFAULT_MAX_SECONDS = CLUE_TURN_DURATION_MS / 1000;

/** "3 MENIT" / "30 DETIK" for the header of the timer. */
export function formatClueLimit(seconds: number): string {
  return formatClueSeconds(seconds).toUpperCase();
}

export function SpokenClueTimer({ deadlineAt, serverNow, onExpire, onFinish, disabled = false, mode = "turn", maxSeconds = DEFAULT_MAX_SECONDS }: { deadlineAt: string | null; serverNow?: number; onExpire: () => void; onFinish: () => void; disabled?: boolean; mode?: "turn" | "round"; maxSeconds?: number }) {
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const clientNow = Date.now();
    const referenceNow = serverNow ?? clientNow;
    const deadline = deadlineAt ? clientNow + Math.max(0, Date.parse(deadlineAt) - referenceNow) : clientNow + maxSeconds * 1000;
    let expired = false;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !expired) {
        expired = true;
        expireRef.current();
      }
    };
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadlineAt, serverNow, maxSeconds]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return <div className="spoken-timer">
    <span className="section-kicker">{mode === "round" ? "RONDE PETUNJUK" : "PETUNJUK LISAN"} · MAKS. {formatClueLimit(maxSeconds)}</span>
    <time className={`timer-value${secondsLeft <= Math.min(30, maxSeconds / 4) ? " timer-warning" : ""}`} aria-label={`${minutes} menit ${seconds} detik`} aria-live="off">{minutes}:{seconds}</time>
    <p className="muted-copy">{mode === "round" ? "Beri clue dan diskusikan langsung. Waktu ronde berakhir saat timer habis." : "Sampaikan petunjukmu secara lisan. Giliran berakhir saat waktu habis."}</p>
    <button className="primary-button" disabled={disabled} onClick={onFinish}>{mode === "round" ? "Akhiri ronde clue" : "Selesai memberi petunjuk"} <span>→</span></button>
  </div>;
}
