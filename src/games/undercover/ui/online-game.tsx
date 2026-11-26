"use client";

import "./undercover.css";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CatalogLink } from "@/components/site/catalog-link";
import { useRouter } from "next/navigation";
import { DEFAULT_CLUE_MINUTES, formatClueMinutes, type GamePhase, type PlayerView } from "@/games/undercover/contract";
import { useRoomEvents, type RoomEventStatus } from "@/lib/realtime/use-room-events";
import { SpokenClueTimer } from "@/games/undercover/ui/spoken-clue-timer";
import { CATEGORY_LABELS, ROLE_LABELS as roleNames } from "@/games/undercover/ui/labels";

interface ViewResponse {
  sessionId: string;
  roomId: string;
  roomCode: string;
  stateVersion: number;
  round: number;
  status: string;
  view: PlayerView;
  hasVoted: boolean;
  isHost?: boolean;
  votesSubmitted: number;
  serverNow: number;
}
interface ApiPayload { data?: ViewResponse; error?: { message?: string; code?: string } }

const WIN_RULES = {
  civilian: "Civilian menang saat tidak ada Undercover maupun Mr. White yang tersisa.",
  undercover: "Undercover menang saat jumlah Undercover yang hidup sama dengan atau lebih banyak dari Civilian yang hidup (Mr. White tidak dihitung).",
  "mr-white": "Mr. White menang seketika jika, setelah tereliminasi, ia menebak kata Civilian dengan benar.",
} as const;

export default function OnlineGame({ roomCode, sessionId }: { roomCode: string; sessionId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ViewResponse | null>(null);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Menghubungkan…");
  // Before the first word card: a 2 second popup naming the category and the discussion minutes, then it pops down.
  const [intro, setIntro] = useState<"pending" | "show" | "leaving" | "done">("pending");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/view`, { cache: "no-store" });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Permainan belum dapat dimuat.");
        setConnection("Menyambungkan ulang…");
        return;
      }
      setSnapshot(payload.data);
      setConnection("Terhubung");
      setError("");
    } catch {
      setConnection("Menyambungkan ulang…");
    }
  }, [sessionId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 8000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const onEventStatus = useCallback((status: RoomEventStatus) => setConnection(status === "live" ? "Terhubung" : status === "connecting" ? "Menghubungkan…" : "Menyambungkan ulang…"), []);
  useRoomEvents(snapshot ? roomCode : null, load, onEventStatus);

  async function perform(action: Record<string, unknown>) {
    if (!snapshot) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: snapshot.stateVersion, action }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Aksi belum tersimpan.");
      setGuess("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi belum tersimpan.");
      await load();
    } finally { setBusy(false); }
  }

  /** The server moves the phase on from its own clock; ask for the new state, and once more shortly after in case the clocks differ slightly. */
  const onClueTimeUp = useCallback(() => { void load(); window.setTimeout(() => void load(), 1500); }, [load]);

  const state = snapshot?.view;
  const phase: GamePhase | undefined = state?.public.phase;
  const introKey = `pq-intro-${sessionId}`;
  useEffect(() => {
    if (intro !== "pending" || !phase) return;
    let seen = false;
    try { seen = window.sessionStorage.getItem(introKey) === "1"; } catch { /* storage can be blocked */ }
    if (phase !== "reveal" || seen) { const skip = window.setTimeout(() => setIntro("done"), 0); return () => window.clearTimeout(skip); }
    try { window.sessionStorage.setItem(introKey, "1"); } catch { /* storage can be blocked */ }
    const open = window.setTimeout(() => setIntro("show"), 0);
    const leave = window.setTimeout(() => setIntro("leaving"), 1750);
    const close = window.setTimeout(() => setIntro("done"), 2000);
    return () => { window.clearTimeout(open); window.clearTimeout(leave); window.clearTimeout(close); };
  }, [intro, phase, introKey]);
  const viewerId = state?.private?.playerId;
  const clueMaxSeconds = (state?.public.clueMinutes ?? DEFAULT_CLUE_MINUTES) * 60;
  const aliveCount = state?.public.players.filter((player) => player.alive).length ?? 0;
  const votesNeeded = Math.floor(aliveCount / 2) + 1;
  const voteRequests = state?.public.voteRequests ?? [];
  const iRequestedVote = Boolean(viewerId && voteRequests.includes(viewerId));
  const showMyWord = Boolean(state?.private && phase && phase !== "reveal" && phase !== "finished");
  const eligibleVotes = state?.public.players.filter((player) => player.alive && player.id !== viewerId && (phase !== "revote" || state.public.tiedPlayerIds.includes(player.id))) ?? [];
  const viewerAlive = state?.public.players.find((player) => player.id === viewerId)?.alive ?? true;
  const outPlayer = state?.public.players.find((player) => player.id === state.public.eliminatedPlayerId);
  const showOutcome = phase === "clue" || phase === "discussion" || phase === "voting" || phase === "revote";
  const whiteTurn = phase === "mr-white-guess" && viewerId === state?.public.eliminatedPlayerId;

  return <main className="page-shell undercover-theme"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">P</span>partyquest</Link><span className="topbar-note"><span className="live-dot" />{connection}</span></header><section className="game-wrap"><div className="game-topline"><span className="topline-links"><button className="text-button" onClick={() => router.push(`/room/${roomCode}`)}>← Kembali ke lobi</button><CatalogLink /></span><span>ROOM {roomCode} · RONDE {snapshot?.round ?? "—"}</span></div><div className="game-card">
    {!snapshot ? <><span className="section-kicker">MEMUAT PERMAINAN</span><h2>Menyiapkan <em>meja…</em></h2><p className="muted-copy">{connection}</p></> : <>
      {showOutcome && outPlayer && <p className="white-callout" role="status"><b>{outPlayer.name}</b> dikeluarkan dari permainan lewat voting.{viewerId === outPlayer.id ? " Kamu sudah keluar; ikuti jalannya game sebagai penonton." : ""}</p>}
      {showOutcome && !outPlayer && state?.public.lastRoundTied && <p className="white-callout" role="status">Suara seri lagi, jadi tidak ada yang dikeluarkan. Ronde berlanjut.</p>}
      {phase === "reveal" && state?.private && intro === "done" && <><span className="section-kicker">KARTU PRIVAT</span><h2>Kata rahasiamu</h2><div className="secret-card"><p>KATA RAHASIA</p><strong>{state.private.word ?? "Kamu Mr. White"}</strong><small>Jangan perlihatkan layar ini. Setelah mengingat kartu, tandai siap agar fase petunjuk dimulai.</small><button className="primary-button" disabled={busy || state.public.revealedPlayerIds.includes(viewerId ?? "")} onClick={() => void perform({ type: "confirm-reveal" })}>{state.public.revealedPlayerIds.includes(viewerId ?? "") ? "Sudah siap · menunggu pemain lain" : "Saya sudah mengingat kata"}<span>✓</span></button></div></>}
      {phase === "clue" && <><span className="section-kicker">RONDE PETUNJUK · {snapshot.round}</span><h2>Beri petunjuk <em>secara lisan.</em></h2><SpokenClueTimer key={`${snapshot.round}-${state?.public.clueIndex}`} mode="round" deadlineAt={state?.public.clueDeadlineAt ?? null} serverNow={snapshot.serverNow} maxSeconds={clueMaxSeconds} onExpire={onClueTimeUp} onFinish={snapshot.isHost ? () => void perform({ type: "end-clue" }) : undefined} disabled={busy} />{viewerAlive && <div className="uc-vote-request"><button type="button" className={iRequestedVote ? "secondary-button is-on" : "secondary-button"} disabled={busy} onClick={() => void perform({ type: "request-vote" })}>{iRequestedVote ? "Batalkan usul voting" : "Usul mulai voting"} · {voteRequests.length}/{votesNeeded}</button><small>Voting langsung dimulai jika mayoritas pemain setuju{snapshot.isHost ? "; sebagai host kamu bisa memulainya kapan saja" : ", atau host memulainya"}.</small></div>}<p className="muted-copy">Semua pemain memberi petunjuk bebas selama waktu berjalan. Timer sama di semua HP dan tidak berubah saat ada yang selesai bicara.</p></>}
      {phase === "discussion" && <><span className="section-kicker">DISKUSI TERBUKA</span><h2>Siapa yang <em>terlihat berbeda?</em></h2><p className="muted-copy">Diskusikan petunjuk bersama. Semua pemain dapat membuka fase voting setelah siap.</p><button className="primary-button wide-button" disabled={busy} onClick={() => void perform({ type: "finish-discussion" })}>Lanjut ke voting <span>→</span></button></>}
      {(phase === "voting" || phase === "revote") && <><span className="section-kicker">{phase === "revote" ? "VOTING ULANG · SUARA SERI" : "PEMILIHAN PEMAIN"}</span><h2>{snapshot.hasVoted ? <>Pilihanmu <em>tersimpan.</em></> : <>Pilih pemain yang <em>dicurigai.</em></>}</h2>{!viewerAlive ? <p className="muted-copy">Kamu sudah dikeluarkan dan tidak dapat memilih. Menunggu suara pemain lain · {snapshot.votesSubmitted}/{state?.public.players.filter((player) => player.alive).length}</p> : snapshot.hasVoted ? <p className="muted-copy">Menunggu suara pemain lain · {snapshot.votesSubmitted}/{state?.public.players.filter((player) => player.alive).length}</p> : <><p className="muted-copy">Pilih satu pemain. Pilihanmu tersembunyi hingga semua pemain memilih.</p><div className="vote-list">{eligibleVotes.map((player) => <button className="vote-choice" key={player.id} disabled={busy} onClick={() => void perform({ type: "cast-vote", targetPlayerId: player.id })}><span className="avatar-dot">{player.name.slice(0, 1).toUpperCase()}</span>{player.name}<span className="vote-arrow">→</span></button>)}</div></>}</>}
      {phase === "mr-white-guess" && <><span className="section-kicker">KESEMPATAN TERAKHIR</span>{whiteTurn ? <><h2>Tebak kata <em>Civilian.</em></h2><p className="white-callout">Kamu Mr. White dan sudah tereliminasi. Tebakan yang benar memenangkan permainan.</p><form className="action-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void perform({ type: "guess-civilian-word", guess }); }}><label className="field-label" htmlFor="mr-white-guess">Kata Civilian</label><input id="mr-white-guess" value={guess} onChange={(event) => setGuess(event.target.value)} maxLength={60} placeholder="Masukkan tebakan" /><button className="primary-button" disabled={busy || !guess.trim()}>Kunci tebakan <span>→</span></button></form></> : <><h2>Mr. White sedang <em>menebak…</em></h2><p className="muted-copy">Berikan perangkat kepada pemain yang tereliminasi. Pemain lain tidak dapat melihat tebakan privatnya.</p></>}</>}
      {phase === "finished" && state?.result && <><span className="section-kicker">PERMAINAN SELESAI</span><h2 className="result-title">{state.result.winner === "civilian" ? "Civilian menang!" : state.result.winner === "undercover" ? "Undercover menang!" : "Mr. White menang!"}</h2><p className="muted-copy">{state.result.reason}</p><p className="white-callout" role="status">Pemenang: <b>{state.result.assignments.filter((assignment) => assignment.role === state.result!.winner).map((assignment) => state.public.players.find((player) => player.id === assignment.playerId)?.name).join(", ")}</b></p><p className="muted-copy">Aturan: {WIN_RULES[state.result.winner]}</p><div className="reveal-results"><p>Kata Civilian <strong>{state.result.civilianWord}</strong></p><p>Kata Undercover <strong>{state.result.undercoverWord}</strong></p><div className="role-results">{state.result.assignments.map((assignment) => <span key={assignment.playerId}>{state.public.players.find((player) => player.id === assignment.playerId)?.name}: <b>{roleNames[assignment.role]}</b></span>)}</div></div><button className="primary-button wide-button" onClick={() => router.push(`/room/${roomCode}`)}>Kembali ke lobi <span>→</span></button></>}
      {showMyWord && state?.private && <details className="uc-myword"><summary>Lihat kata saya</summary><strong>{state.private.word ?? "Kamu Mr. White (tidak punya kata)"}</strong><small>Jangan perlihatkan layar ini ke pemain lain.</small></details>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </>}</div>
    {(intro === "show" || intro === "leaving") && state && <div className={`uc-intro${intro === "leaving" ? " is-leaving" : ""}`} role="dialog" aria-live="polite" aria-label="Info ronde"><div className="uc-intro-card">
      <span className="section-kicker">RONDE DIMULAI</span>
      <dl><div><dt>Kategori</dt><dd>{state.public.category ? CATEGORY_LABELS[state.public.category] : "Rahasia"}</dd></div><div><dt>Waktu diskusi</dt><dd>{formatClueMinutes(state.public.clueMinutes ?? DEFAULT_CLUE_MINUTES)}</dd></div></dl>
      <small>Bersiaplah melihat kata rahasiamu…</small>
    </div></div>}</section><footer className="footer"><span>PARTYQUEST <span className="footer-star">✦</span> ONLINE GAME</span><span>Perubahan state dikirim sebagai notifikasi, lalu view diambil ulang</span></footer></main>;
}
