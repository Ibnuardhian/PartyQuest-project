"use client";

import { useEffect, useRef, useState } from "react";
import { makeTapGrid } from "@/games/werewolf/ui/fake-tap-layout";
import { useCooldown } from "@/games/werewolf/ui/use-cooldown";

/**
 * Fake Tap mini-game for alive players outside their turn (docs/03 §2.2). It uses the same tile grid as the
 * real target picker, with numbers instead of names, so tapping reveals nothing about who is acting.
 * `size` is the number of tiles the real picker would show; the parent re-keys this component when it changes.
 * The panel is only rendered on the client (after the first game snapshot), so shuffling in the initializer is safe.
 */
export function FakeTap({ size }: { size: number }) {
  const [grid, setGrid] = useState(() => makeTapGrid(size, Math.random));
  const [next, setNext] = useState(1);
  /** Bumped on every reshuffle so the tiles are new elements and appear one by one again. */
  const [round, setRound] = useState(0);
  const timer = useRef<number | null>(null);
  // Every tap (right or wrong) locks the grid briefly, like a real action, so it cannot be mashed.
  const { cooling, start: cool } = useCooldown();

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function reshuffle() {
    setGrid(makeTapGrid(size, Math.random));
    setNext(1);
    setRound((current) => current + 1);
  }

  function tap(number: number) {
    if (cooling) return;
    cool();
    if (number !== next) return;
    setNext(number + 1);
    if (number < grid.goal) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(reshuffle, 400);
  }

  return <div className="ww-panel ww-fake-tap">
    <p className="ww-night-hint">Ketuk angka {grid.goal === 3 ? "1 sampai 3" : "1 sampai 4"} secara berurutan.</p>
    <div className="ww-targets is-staggered" role="group" aria-label="Ketuk angka sesuai urutan">
      {grid.tiles.map((number, index) => <button
        key={`${round}-${number}`}
        style={{ "--i": index } as React.CSSProperties}
        type="button"
        className={`ww-target${number < next && number <= grid.goal ? " is-selected" : ""}`}
        aria-pressed={number < next && number <= grid.goal}
        disabled={cooling}
        onClick={() => tap(number)}
      ><span>{number}</span></button>)}
    </div>
    <button type="button" className="ww-button" disabled={cooling} onClick={() => { cool(); reshuffle(); }}>Lewati giliran</button>
  </div>;
}
