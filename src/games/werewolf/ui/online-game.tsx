"use client";

import "./werewolf.css";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogLink } from "@/components/site/catalog-link";
import { ConnectionNote, SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import type { ClassicRole } from "@/games/werewolf/contract";
import { FakeTap } from "@/games/werewolf/ui/fake-tap";
import { FACTION_LABELS, isNightPhase, PHASE_LABELS, roleName, type WerewolfSnapshot } from "@/games/werewolf/ui/labels";
import { NightActionPanel } from "@/games/werewolf/ui/night-actions";
import { HunterShot } from "@/games/werewolf/ui/hunter-shot";
import { RoleCard } from "@/games/werewolf/ui/role-card";
import { formatSeconds, useCountdown } from "@/games/werewolf/ui/use-countdown";
import { useNarration } from "@/games/werewolf/ui/use-narration";
import { useRoomEvents, type RoomEventStatus } from "@/lib/realtime/use-room-events";

/** Werewolf Classic screen for Online Room. All state comes from the server's per-player view. */
export default function WerewolfOnlineGame({ roomCode, sessionId }: { roomCode: string; sessionId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WerewolfSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Menghubungkan…");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/view`, { cache: "no-store" });
      const payload = await response.json() as { data?: Omit<WerewolfSnapshot, "receivedAt">; error?: { message?: string } };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Permainan belum dapat dimuat.");
        return;
      }
      setSnapshot({ ...payload.data, receivedAt: Date.now() });
      setConnection("Terhubung");
    } catch {
      setConnection("Menyambungkan ulang…");
    }
  }, [sessionId]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 8000);
    return () => { window.clearTimeout(first); window.clearInterval(poll); };
  }, [load]);

  const onEventStatus = useCallback((status: RoomEventStatus) => setConnection(status === "live" ? "Terhubung" : status === "connecting" ? "Menghubungkan…" : "Menyambungkan ulang…"), []);
  useRoomEvents(snapshot ? roomCode : null, load, onEventStatus);

  // Refetch right after the server deadline so the phase advances (server time, not the browser's).
  const deadlineAt = snapshot?.public.phaseDeadlineAt ?? null;
  const skew = snapshot ? snapshot.serverNow - snapshot.receivedAt : 0;
  useEffect(() => {
    if (!deadlineAt) return;
    const wait = Math.max(0, Date.parse(deadlineAt) - skew - Date.now()) + 400;
    const timer = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(timer);
  }, [deadlineAt, skew, load]);

  const secondsLeft = useCountdown(deadlineAt, snapshot?.serverNow ?? 0, snapshot?.receivedAt ?? 0);
  // The narrator speaks first; the players' own countdown only starts once the voice is done.
  const narratorLeft = useCountdown(snapshot?.public.actionStartsAt ?? null, snapshot?.serverNow ?? 0, snapshot?.receivedAt ?? 0);
  const narratorSpeaking = narratorLeft !== null && narratorLeft > 0;
  const narration = useNarration(snapshot?.public ?? null, sessionId, Boolean(snapshot?.you.isHost && !snapshot.tvConnected), secondsLeft);

  async function perform(action: Record<string, unknown>) {
    if (!snapshot) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: snapshot.stateVersion, action }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) setError(payload.error?.message ?? "Aksi belum tersimpan.");
    } catch {
      setError("Aksi belum tersimpan. Periksa koneksi.");
    } finally {
      await load();
      setBusy(false);
    }
  }

  function forceAdvance() {
    if (window.confirm("Paksa lanjut? Pemain yang belum beraksi dianggap AFK.")) void perform({ type: "force-advance" });
  }

  const view = snapshot;
  const phase = view?.public.phase;
  const night = phase ? isNightPhase(phase) : false;
  const me = view?.public.players.find((player) => player.id === view.you.playerId);
  /** How many tiles the real night picker shows (everyone alive but me); the Fake Tap grid copies it. */
  const targetCount = view ? view.public.players.filter((player) => player.alive && player.id !== view.you.playerId).length : 0;
  const nameOf = (id: string | null | undefined) => view?.public.players.find((player) => player.id === id)?.name ?? "—";

  return <main className={`page-shell werewolf-theme${night && view?.you.alive ? " ww-is-night" : ""}`}>
    <SiteHeader><ConnectionNote label={connection} /></SiteHeader>
    <section className="ww-game">
      <div className="ww-topline">
        <span className="topline-links"><button type="button" className="text-button" onClick={() => router.push(`/room/${roomCode}`)}>← Lobi</button><CatalogLink /></span>
        <span>ROOM {roomCode}{view ? ` · ${view.public.dayNumber > 0 ? `HARI ${view.public.dayNumber}` : `MALAM ${Math.max(1, view.public.nightNumber)}`}` : ""}</span>
      </div>

      {!view || !phase ? <div className="ww-panel"><span className="section-kicker">MEMUAT</span><h2>Menyiapkan desa…</h2>{error && <p className="ww-alert" role="alert">{error}</p>}</div> : <>
        <header className="ww-phase">
          <span className="section-kicker">{PHASE_LABELS[phase]}{view.public.activeNightRole && phase === "NIGHT_TURN" && (view.you.isMyTurn || !view.you.alive) ? ` · ${roleName(view.public.activeNightRole)}` : ""}</span>
          {secondsLeft !== null && (narratorSpeaking
            ? <span className="ww-timer ww-timer-wait" role="status">Narator berbicara…</span>
            : <time className="ww-timer" aria-label={`Sisa waktu ${secondsLeft} detik`}>{view.public.overtime ? "Waktu tambahan " : ""}{formatSeconds(secondsLeft)}</time>)}
        </header>

        {view.notices.map((notice) => <p key={notice} className="ww-notice" role="status">{notice}</p>)}

        {phase === "ROLE_REVEAL" && <div className="ww-panel ww-center">
          <RoleCard role={view.you.role} />
          <KnownTeam view={view} nameOf={nameOf} />
          <button type="button" className="ww-button ww-primary" disabled={busy || view.you.ready} onClick={() => void perform({ type: "ready" })}>{view.you.ready ? "Menunggu pemain lain…" : "Saya siap"}</button>
          <p className="ww-muted">{view.public.readyPlayerIds.length}/{view.public.players.length} pemain siap</p>
        </div>}

        {night && (!view.you.alive ? <DeadView view={view} nameOf={nameOf} /> : <div className="ww-night-stage">
          {view.you.isMyTurn
            ? <div key={`turn-${view.public.activeNightRole}`} className="ww-panel ww-fade"><span className="ww-your-turn">GILIRANMU</span><NightActionPanel view={view} busy={busy} perform={perform} /></div>
            : <div key="fake" className="ww-fade"><FakeTap key={targetCount} size={targetCount} /></div>}
        </div>)}

        {!night && phase !== "ROLE_REVEAL" && phase !== "GAME_OVER" && <div className="ww-panel">
          {!view.you.alive && <DeadView view={view} nameOf={nameOf} />}
          <DayAnnouncement view={view} nameOf={nameOf} />
          {phase === "HUNTER_REVENGE" && (view.public.hunterId === view.you.playerId
            ? <HunterShot targets={view.public.players.filter((player) => player.alive && player.id !== view.you.playerId)} busy={busy} onShoot={(targetId) => perform({ type: "hunter-shot", targetId })} />
            : <h2>Sang Pemburu sedang membidik…</h2>)}
          {phase === "DAY_DISCUSSION" && <>
            <h2>Diskusikan secara langsung</h2>
            <p className="ww-muted">Bicarakan siapa yang mencurigakan. Voting dimulai saat waktu habis atau mayoritas setuju melewati diskusi.</p>
            {view.you.alive && <button type="button" className="ww-button" disabled={busy || view.public.skipDiscussionIds.includes(view.you.playerId)} onClick={() => void perform({ type: "skip-discussion" })}>Lewati diskusi ({view.public.skipDiscussionIds.length}/{view.public.players.filter((player) => player.alive).length})</button>}
          </>}
          {phase === "TIE_DEFENSE" && <><h2>Pembelaan kandidat seri</h2><p className="ww-muted">{view.public.tiedPlayerIds.map(nameOf).join(", ")} punya waktu untuk membela diri sebelum voting ulang.</p></>}
          {(phase === "OPEN_VOTING" || phase === "TIE_REVOTE") && <Voting view={view} busy={busy} perform={perform} nameOf={nameOf} />}
        </div>}

        {phase === "GAME_OVER" && <GameOver view={view} nameOf={nameOf} onLobby={() => router.push(`/room/${roomCode}`)} />}

        {view.you.alive && phase !== "ROLE_REVEAL" && phase !== "GAME_OVER" && <details className="ww-mycard"><summary>Kartu role saya</summary><RoleCard role={view.you.role} initiallyOpen /><KnownTeam view={view} nameOf={nameOf} /></details>}

        {error && <p className="ww-alert" role="alert">{error}</p>}

        {view.you.isHost && phase !== "GAME_OVER" && <div className="ww-host">
          <span className="section-kicker">KONTROL HOST</span>
          {view.tvConnected && <span className="ww-muted">Suara moderator diputar di layar TV.</span>}
          {narration.isAudioDevice && (narration.enabled
            ? <button type="button" className="ww-button" onClick={narration.disable}>Matikan suara moderator</button>
            : <button type="button" className="ww-button ww-primary" onClick={() => void narration.enable()}>Aktifkan suara moderator</button>)}
          <button type="button" className="ww-button" disabled={busy} onClick={forceAdvance}>Paksa lanjut</button>
        </div>}
        {me && !me.canVote && me.alive && <p className="ww-notice">Hak voting kamu dicabut untuk putaran ini karena AFK.</p>}
      </>}
    </section>
    <SiteFooter left="WEREWOLF · ONLINE" right="Suara moderator: Microsoft Edge Neural (cadangan: suara browser)" />
  </main>;
}

type ViewProps = { view: WerewolfSnapshot; nameOf: (id: string | null | undefined) => string };

function KnownTeam({ view, nameOf }: ViewProps) {
  const team = Object.entries(view.knownRoles).filter(([id]) => id !== view.you.playerId);
  const lovers = view.lovers?.filter((id) => id !== view.you.playerId);
  if (team.length === 0 && !lovers?.length) return null;
  return <div className="ww-team">
    {team.length > 0 && <p>Kamu mengenali: {team.map(([id, role]) => `${nameOf(id)} (${roleName(role as ClassicRole)})`).join(", ")}</p>}
    {view.lovers && <p>Sepasang kekasih: {view.lovers.map(nameOf).join(" & ")}</p>}
  </div>;
}

function DeadView({ view, nameOf }: ViewProps) {
  const spectator = Object.keys(view.knownRoles).length > 1;
  return <div className="ww-panel ww-dead" role="status">
    <span className="section-kicker">KAMU TELAH TERELIMINASI</span>
    <p className="ww-muted">Kamu tidak dapat beraksi di malam hari atau memilih di siang hari. Tetap diam dan ikuti permainan.</p>
    {spectator && <ul className="ww-role-list">{Object.entries(view.knownRoles).map(([id, role]) => <li key={id}><span>{nameOf(id)}</span><strong>{roleName(role as ClassicRole)}</strong></li>)}</ul>}
  </div>;
}

function DayAnnouncement({ view, nameOf }: ViewProps) {
  const last = view.public.log.at(-1);
  const reveal = view.public.lastVoteReveal;
  return <>
    {last?.type === "DAWN" && <p className="ww-result">{last.deadPlayerIds.length === 0 ? "Tidak ada korban semalam." : `Korban semalam: ${last.deadPlayerIds.map(nameOf).join(", ")}.`}</p>}
    {last?.type === "HUNTER" && <p className="ww-result">Pemburu menembak {nameOf(last.targetId)}.</p>}
    {reveal && reveal.length > 0 && (view.public.phase === "TIE_DEFENSE" || view.public.phase === "NIGHT_INTRO" || view.public.phase === "HUNTER_REVENGE") && <VoteMatrix reveal={reveal} nameOf={nameOf} />}
  </>;
}

function VoteMatrix({ reveal, nameOf }: { reveal: NonNullable<WerewolfSnapshot["public"]["lastVoteReveal"]>; nameOf: ViewProps["nameOf"] }) {
  return <ul className="ww-matrix" aria-label="Hasil voting terbuka">{reveal.map((vote) => <li key={vote.voterId}><span>{nameOf(vote.voterId)}</span><span aria-hidden="true">→</span><strong>{vote.targetId ? nameOf(vote.targetId) : "Abstain"}</strong>{vote.weight > 1 && <small>×{vote.weight}</small>}</li>)}</ul>;
}

function Voting({ view, busy, perform, nameOf }: ViewProps & { busy: boolean; perform: (action: Record<string, unknown>) => Promise<void> }) {
  const revote = view.public.phase === "TIE_REVOTE";
  const candidates = view.public.players.filter((player) => player.alive && player.id !== view.you.playerId && (!revote || view.public.tiedPlayerIds.includes(player.id)));
  const eligible = view.public.players.filter((player) => player.alive && player.canVote);
  const canVote = view.you.alive && view.you.canVote;
  return <>
    <h2>{revote ? "Voting ulang" : "Pilih yang akan dieksekusi"}</h2>
    <p className="ww-muted">Pilihan tersembunyi sampai semua memilih, lalu dibuka bersamaan.</p>
    {canVote && <div className="ww-targets">
      {candidates.map((player) => <button key={player.id} type="button" className={`ww-target${view.you.myVote === player.id ? " is-selected" : ""}`} aria-pressed={view.you.myVote === player.id} disabled={busy} onClick={() => void perform({ type: "vote", targetId: player.id })}>{player.name}</button>)}
      <button type="button" className={`ww-target${view.you.myVote === null ? " is-selected" : ""}`} aria-pressed={view.you.myVote === null} disabled={busy} onClick={() => void perform({ type: "vote", targetId: null })}>Abstain</button>
    </div>}
    <ul className="ww-voted" aria-label="Status voting">{eligible.map((player) => <li key={player.id} className={view.public.votedPlayerIds.includes(player.id) ? "is-voted" : ""}>{view.public.votedPlayerIds.includes(player.id) ? "✓" : "…"} {nameOf(player.id)}</li>)}</ul>
  </>;
}

function GameOver({ view, nameOf, onLobby }: ViewProps & { onLobby: () => void }) {
  const winner = view.public.winner;
  const roles = view.public.finalRoles ?? {};
  return <div className="ww-panel">
    <span className="section-kicker">PERMAINAN SELESAI</span>
    <h2>{winner ? `${FACTION_LABELS[winner.faction]} menang!` : "Permainan selesai"}</h2>
    <p className="ww-muted">{view.public.winReason}</p>
    {view.public.lastVoteReveal && view.public.lastVoteReveal.length > 0 && <VoteMatrix reveal={view.public.lastVoteReveal} nameOf={nameOf} />}
    <ul className="ww-role-list">{view.public.players.map((player) => {
      const role = roles[player.id] as ClassicRole | undefined;
      const original = view.public.originalRoles?.[player.id] as ClassicRole | undefined;
      return <li key={player.id} className={winner?.playerIds.includes(player.id) ? "is-winner" : ""}><span>{player.name}{player.alive ? "" : " †"}</span><strong>{role ? roleName(role) : "—"}{original && original !== role ? ` (awalnya ${roleName(original)})` : ""}</strong></li>;
    })}</ul>
    {view.public.lovers && <p className="ww-muted">Sepasang kekasih: {view.public.lovers.map(nameOf).join(" & ")}</p>}
    <ol className="ww-timeline" aria-label="Linimasa permainan">{view.public.log.map((entry, index) => <li key={index}>{
      entry.type === "DAWN" ? `Malam ${entry.night}: ${entry.deadPlayerIds.length ? `${entry.deadPlayerIds.map(nameOf).join(", ")} tewas` : "tidak ada korban"}`
        : entry.type === "EXECUTION" ? `Hari ${entry.day}: ${entry.playerId ? `${nameOf(entry.playerId)} dieksekusi` : "tidak ada eksekusi"}`
          : entry.type === "HUNTER" ? `Pemburu ${nameOf(entry.hunterId)} ${entry.targetId ? `menembak ${nameOf(entry.targetId)}` : "tidak menembak"}`
            : `${nameOf(entry.playerId)} tereliminasi karena AFK`
    }</li>)}</ol>
    <button type="button" className="ww-button ww-primary" onClick={onLobby}>Kembali ke lobi untuk main ulang</button>
  </div>;
}
