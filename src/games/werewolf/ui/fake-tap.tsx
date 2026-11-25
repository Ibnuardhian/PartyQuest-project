"use client";

import { useEffect, useRef, useState } from "react";
import { makeTapGrid } from "@/games/werewolf/ui/fake-tap-layout";

/**
 * Fake Tap mini-game for alive players outside their turn (docs/03 §2.2). It uses the same tile grid as the
 * real target picker, with numbers instead of names, so tapping reveals nothing about who is acting.
 * `size` is the number of tiles the real picker would show; the parent re-keys this component when it changes.
 * The panel is only rendered on the client (after the first game snapshot), so shuffling in the initializer is safe.
 */
export function FakeTap({ size }: { size: number }) {
  const [grid, setGrid] = useState(() => makeTapGrid(size, Math.random));
  const [next, setNext] = useState(1);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function reshuffle() {
    setGrid(makeTapGrid(size, Math.random));
    setNext(1);
  }

  function tap(number: number) {
    if (number !== next) return;
    setNext(number + 1);
    if (number < grid.goal) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(reshuffle, 400);
  }

  return <div className="ww-panel ww-fake-tap">
    <p className="ww-night-hint">Ketuk angka {grid.goal === 3 ? "1 sampai 3" : "1 sampai 4"} secara berurutan.</p>
    <div className="ww-targets" role="group" aria-label="Ketuk angka sesuai urutan">
      {grid.tiles.map((number) => <button
        key={number}
        type="button"
        className={`ww-target${number < next && number <= grid.goal ? " is-selected" : ""}`}
        aria-pressed={number < next && number <= grid.goal}
        onClick={() => tap(number)}
      ><span>{number}</span></button>)}
    </div>
    <button type="button" className="ww-button" onClick={reshuffle}>Lewati giliran</button>
  </div>;
}
