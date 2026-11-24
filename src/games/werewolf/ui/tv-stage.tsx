"use client";

import "./werewolf.css";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QrCode } from "@/components/site/qr-code";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import type { ClassicRole } from "@/games/werewolf/contract";
import { WEREWOLF_TV_PATH } from "@/games/werewolf/paths";
import { FACTION_LABELS, isNightPhase, PHASE_LABELS, roleName, type WerewolfView } from "@/games/werewolf/ui/labels";
import { formatSeconds, useCountdown } from "@/games/werewolf/ui/use-countdown";
import { useNarration } from "@/games/werewolf/ui/use-narration";
import { VoteArrows } from "@/games/werewolf/ui/vote-arrows";

interface TvData {
  room: { code: string; status: string; gameKey: string };
  members: Array<{ name: string; online: boolean; ready: boolean }>;
  session: { sessionId: string; stateVersion: number; status: string; view: WerewolfView["public"] } | null;
  serverNow: number;
  receivedAt: number;
}

/** Shared screen (docs/03 §3): public stage only, and the single audio device while connected. */
export default function WerewolfTvStage({ code }: { code: string }) {
  const [data, setData] = useState<TvData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}/tv`, { cache: "no-store" });
      const payload = await response.json() as { data?: Omit<TvData, "receivedAt">; error?: { message?: string } };
      if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Data TV belum dapat dimuat."); return; }
      setData({ ...payload.data, receivedAt: Date.now() });
      setError("");
    } catch {
      setError("Koneksi terputus, mencoba lagi…");
    }
  }, [code]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 2500);
    return () => { window.clearTimeout(first); window.clearInterval(poll); };
  }, [load]);

  const view = data?.session?.view ?? null;
  const deadlineAt = view?.phaseDeadlineAt ?? null;
  const secondsLeft = useCountdown(deadlineAt, data?.serverNow ?? 0, data?.receivedAt ?? 0);
  const narration = useNarration(view, data?.session?.sessionId ?? null, true, secondsLeft);
  const nameOf = (id: string | null | undefined) => view?.players.find((player) => player.id === id)?.name ?? "—";
  const lastDawn = view ? [...view.log].reverse().find((entry) => entry.type === "DAWN") : undefined;

  return <main className={`page-shell werewolf-theme ww-tv${view && isNightPhase(view.phase) ? " ww-is-night" : ""}`}>
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> TV · ROOM {code}</span></SiteHeader>
    <section className="ww-tv-stage">
      {error && !data && <div className="ww-panel"><p className="ww-alert" role="alert">{error}</p><Link className="ww-button" href={WEREWOLF_TV_PATH}>Hubungkan ulang</Link></div>}
      {data && <>
        <header className="ww-tv-top">
          <span className="ww-tv-code">{data.room.code}</span>
          <span className="ww-tv-phase">{view ? PHASE_LABELS[view.phase] : "Lobi"}{view?.activeNightRole && view.phase === "NIGHT_TURN" ? ` · ${roleName(view.activeNightRole)}` : ""}</span>
          {secondsLeft !== null && <time className="ww-tv-timer">{formatSeconds(secondsLeft)}</time>}
          {!narration.enabled ? <button type="button" className="ww-button ww-primary" onClick={() => void narration.enable()}>Aktifkan suara</button> : <button type="button" className="ww-button" onClick={narration.disable}>Matikan suara</button>}
        </header>

        {!view && <div className="ww-panel"><h2>Menunggu pemain</h2>{data.room.status === "lobby" && <QrCode className="ww-tv-qr" path={`/room/${data.room.code}`} label={`Pindai untuk bergabung · kode ${data.room.code}`} />}<ul className="ww-tv-grid">{data.members.map((member) => <li key={member.name} className={member.ready ? "is-ready" : ""}><strong>{member.name}</strong><small>{member.ready ? "Siap" : member.online ? "Online" : "Offline"}</small></li>)}</ul></div>}

        {view && <>
          <ul className="ww-tv-grid" aria-label="Pemain">{view.players.map((player) => <li key={player.id} className={`${player.alive ? "" : "is-dead"} ${view.votedPlayerIds.includes(player.id) ? "has-voted" : ""} ${view.tiedPlayerIds.includes(player.id) ? "is-tied" : ""}`}>
            <strong>{player.name}</strong>
            <small>{player.alive ? (view.votedPlayerIds.includes(player.id) ? "✓ sudah memilih" : player.hasAfkPenalty ? "AFK" : "") : player.death === "EXECUTION" ? "Dieksekusi" : player.death === "HUNTER" ? "Ditembak Pemburu" : player.death === "DEAD_AFK" ? "AFK" : "Tewas"}</small>
            {view.finalRoles && <em>{roleName(view.finalRoles[player.id] as ClassicRole)}</em>}
          </li>)}</ul>
          {view.phase === "GAME_OVER" && view.winner && <div className="ww-panel ww-center"><h2>{FACTION_LABELS[view.winner.faction]} menang!</h2><p className="ww-muted">{view.winReason}</p></div>}
          {view.lastVoteReveal && view.lastVoteReveal.length > 0 && ["TIE_DEFENSE", "NIGHT_INTRO", "HUNTER_REVENGE", "GAME_OVER"].includes(view.phase) && <div className="ww-panel ww-vote-reveal"><span className="section-kicker">HASIL VOTING TERBUKA</span><VoteArrows players={view.players} votes={view.lastVoteReveal} /><ul className="ww-matrix">{view.lastVoteReveal.map((vote) => <li key={vote.voterId}><span>{nameOf(vote.voterId)}</span><span aria-hidden="true">→</span><strong>{vote.targetId ? nameOf(vote.targetId) : "Abstain"}</strong>{vote.weight > 1 && <small>×{vote.weight}</small>}</li>)}</ul></div>}
          {view.phase === "DAY_DISCUSSION" && lastDawn?.type === "DAWN" && <p className="ww-tv-ticker">{lastDawn.deadPlayerIds.length ? `Korban semalam: ${lastDawn.deadPlayerIds.map(nameOf).join(", ")}` : "Tidak ada korban semalam."}</p>}
        </>}
        {/* Live moderator subtitle bar (docs/03 §3). */}
        <p className="ww-tv-subtitle" aria-live="polite">{narration.subtitle || (narration.enabled ? "…" : "Ketuk “Aktifkan suara” agar TV menjadi narator.")}</p>
      </>}
    </section>
    <SiteFooter left="WEREWOLF · TV" right="Layar baca-saja: role baru terbuka saat permainan selesai" />
  </main>;
}
