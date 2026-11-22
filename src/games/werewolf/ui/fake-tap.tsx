"use client";

import { useRef, useState } from "react";
import { makeTapSequence } from "@/games/werewolf/ui/fake-tap-layout";

/**
 * Fake Tap mini-game for alive players outside their turn (docs/03 §2.2).
 * Everyone taps during the night, so tapping reveals nothing about roles.
 */
export function FakeTap() {
  const [targets, setTargets] = useState(() => makeTapSequence(Math.random));
  const [next, setNext] = useState(1);
  const timer = useRef<number | null>(null);

  function tap(number: number) {
    if (number !== next) return;
    if (number < targets.length) {
      setNext(number + 1);
      return;
    }
    setNext(targets.length + 1);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setTargets(makeTapSequence(Math.random));
      setNext(1);
    }, 400);
  }

  return <div className="ww-fake-tap">
    <p className="ww-night-hint">Fase Malam Berlangsung — Ketuk lingkaran berurutan untuk menyamarkan aktivitas</p>
    <div className="ww-tap-area" role="group" aria-label="Ketuk lingkaran sesuai urutan angka">
      {targets.map((target) => <button
        key={`${target.number}-${target.x.toFixed(2)}`}
        type="button"
        className={`ww-tap${target.number < next ? " is-done" : ""}`}
        style={{ left: `${target.x}%`, top: `${target.y}%` }}
        onClick={() => tap(target.number)}
        aria-label={`Lingkaran ${target.number}`}
      >{target.number}</button>)}
    </div>
  </div>;
}
