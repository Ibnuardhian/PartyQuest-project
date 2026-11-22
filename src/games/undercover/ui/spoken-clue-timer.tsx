"use client";

import { useEffect, useRef, useState } from "react";
import { CLUE_TURN_DURATION_MS } from "@/games/undercover/contract";

const MAX_SECONDS = CLUE_TURN_DURATION_MS / 1000;

export function SpokenClueTimer({ deadlineAt, serverNow, onExpire, onFinish, disabled = false, mode = "turn" }: { deadlineAt: string | null; serverNow?: number; onExpire: () => void; onFinish: () => void; disabled?: boolean; mode?: "turn" | "round" }) {
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const clientNow = Date.now();
    const referenceNow = serverNow ?? clientNow;
    const deadline = deadlineAt ? clientNow + Math.max(0, Date.parse(deadlineAt) - referenceNow) : clientNow + MAX_SECONDS * 1000;
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
  }, [deadlineAt, serverNow]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return <div className="spoken-timer">
    <span className="section-kicker">{mode === "round" ? "RONDE PETUNJUK · MAKS. 3 MENIT" : "PETUNJUK LISAN · MAKS. 3 MENIT"}</span>
    <time className={`timer-value${secondsLeft <= 30 ? " timer-warning" : ""}`} aria-label={`${minutes} menit ${seconds} detik`} aria-live="off">{minutes}:{seconds}</time>
    <p className="muted-copy">{mode === "round" ? "Beri clue dan diskusikan langsung. Waktu ronde berakhir saat timer habis." : "Sampaikan petunjukmu secara lisan. Giliran berakhir saat waktu habis."}</p>
    <button className="primary-button" disabled={disabled} onClick={onFinish}>{mode === "round" ? "Akhiri ronde clue" : "Selesai memberi petunjuk"} <span>→</span></button>
  </div>;
}
