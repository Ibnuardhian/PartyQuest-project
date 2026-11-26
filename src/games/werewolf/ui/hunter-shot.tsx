"use client";

import { useState } from "react";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

type Player = WerewolfView["public"]["players"][number];

/**
 * The Hunter's last shot (the one action a player takes outside a night turn). Picking a name only selects
 * it; the shot is fired by the dedicated button, so a stray tap cannot kill someone. When the timer runs out
 * without a shot, nobody is hit (the server skips the Hunter).
 */
export function HunterShot({ targets, busy, onShoot }: { targets: Player[]; busy: boolean; onShoot: (targetId: string) => Promise<void> }) {
  const [pick, setPick] = useState<string | null>(null);
  const picked = targets.find((player) => player.id === pick);
  return <>
    <h2>Tembakan terakhirmu</h2>
    <p className="ww-muted">Pilih satu pemain untuk ikut gugur bersamamu, lalu tekan Tembak. Jika waktu habis, kamu tidak menembak siapa pun.</p>
    {targets.length === 0 ? <p className="ww-night-hint">Tidak ada target yang dapat dipilih.</p> : <div className="ww-targets">{targets.map((player) => <button key={player.id} type="button" className={`ww-target${pick === player.id ? " is-selected" : ""}`} aria-pressed={pick === player.id} disabled={busy} onClick={() => setPick(player.id)}>{player.name}</button>)}</div>}
    <button type="button" className="ww-button ww-primary" disabled={busy || !picked} onClick={() => picked && void onShoot(picked.id)}>{picked ? `Tembak ${picked.name}` : "Pilih target dulu"}</button>
  </>;
}
