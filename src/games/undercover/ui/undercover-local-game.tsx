"use client";

import "./undercover.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import type { GameAction, GameState } from "@/games/undercover/contract";
import { confirmOfflineElimination, finishOfflineClueRound, undercoverGame } from "@/games/undercover/engine";
import { clearLocalGameState, LOCAL_GAME_PATH, readLocalGameSession, type LocalGameSession, writeLocalGameSession } from "@/games/undercover/local-session";
import { UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";
import { ROLE_LABELS } from "@/games/undercover/ui/labels";
import { SpokenClueTimer } from "@/games/undercover/ui/spoken-clue-timer";

/** Pass-and-Play runner at /games/undercover/local#<session-hash>. State stays in this tab's sessionStorage. */
export default function UndercoverLocalGame() {
  const router = useRouter();
  const [session, setSession] = useState<LocalGameSession | null>(null);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [eliminationCandidate, setEliminationCandidate] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void readLocalGameSession().then((saved) => {
      if (cancelled) return;
      const requestedHash = window.location.hash.slice(1);
      if (!saved || (requestedHash && requestedHash !== saved.hash)) {
        router.replace(UNDERCOVER_SETUP_PATH);
        return;
      }
      if (!requestedHash) window.history.replaceState(window.history.state, "", `${LOCAL_GAME_PATH}#${saved.hash}`);
      setSession(saved);
    });
    return () => { cancelled = true; };
  }, [router]);

  const game = session?.state ?? null;
  const currentPlayer = game?.public.players.find((player) => !game.public.revealedPlayerIds.includes(player.id));
  const currentAssignment = game && currentPlayer ? game.secret.assignments.find((item) => item.playerId === currentPlayer.id) : undefined;
  const eliminated = game?.public.eliminatedPlayerId ? game.public.players.find((player) => player.id === game.public.eliminatedPlayerId) : undefined;
  const whiteAssignment = game?.secret.assignments.find((item) => item.playerId === game.public.eliminatedPlayerId);

  function save(nextGame: GameState) {
    if (!session) return;
    const nextSession = { ...session, state: nextGame };
    setSession(nextSession);
    if (!writeLocalGameSession(nextSession)) setError("Permainan berjalan, tetapi browser tidak dapat menyimpan progres untuk refresh.");
    setPrivateOpen(false);
  }

  function run(update: (state: GameState) => GameState, fallback: string) {
    if (!game) return;
    setError("");
    try {
      save(update(game));
      setGuessText("");
      setEliminationCandidate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
    }
  }

  const act = (action: GameAction) => run((state) => undercoverGame.applyAction(state, action), "Aksi tidak dapat diproses.");
  const finishClueRound = () => run(finishOfflineClueRound, "Ronde petunjuk tidak dapat diselesaikan.");
  const confirmElimination = () => { if (eliminationCandidate) run((state) => confirmOfflineElimination(state, eliminationCandidate), "Eliminasi tidak dapat dikonfirmasi."); };

  function leave(destination: string) {
    clearLocalGameState();
    router.replace(destination);
  }

  return <main className="page-shell undercover-theme">
    <SiteHeader><div className="topbar-actions"><span className="topbar-note"><span className="live-dot" /> Pass-and-Play · satu perangkat</span></div></SiteHeader>
    {!game ? <section className="game-wrap"><div className="game-card"><span className="section-kicker">MEMUAT PERMAINAN</span><h2>Menyiapkan <em>meja…</em></h2></div></section> : <section className="game-wrap">
      <div className="game-topline"><button className="text-button" onClick={() => leave("/")}>← Keluar ke beranda</button><span>RONDE {game.public.round}</span></div>
      <div className="game-card">
        {game.public.phase === "reveal" && currentPlayer && currentAssignment && <>
          <span className="section-kicker">PEMBAGIAN KATA · {game.public.revealedPlayerIds.length + 1}/{game.public.players.length}</span>
          <h2>Giliran <em>{currentPlayer.name}</em></h2>
          {!privateOpen ? <div className="handoff-panel"><span className="handoff-icon">⌁</span><h3>Pastikan layar tidak terlihat pemain lain</h3><p>Serahkan perangkat kepada {currentPlayer.name}. Hanya ia yang boleh melihat kartu rahasia ini.</p><button className="primary-button" onClick={() => setPrivateOpen(true)}>Buka kartu pribadiku <span>→</span></button></div> : <div className="secret-card"><p>KARTU RAHASIA</p><strong>{currentAssignment.word ?? "Kartu kosong"}</strong><small>Jangan beri tahu isi kartu. Ingat baik-baik, lalu tutup sebelum perangkat diteruskan.</small><button className="primary-button" onClick={() => act({ type: "confirm-reveal", playerId: currentPlayer.id })}>Tutup & lanjutkan <span>→</span></button></div>}
        </>}

        {game.public.phase === "clue" && <><span className="section-kicker">RONDE PETUNJUK · RONDE {game.public.round}</span><h2>Clue secara <em>lisan.</em></h2><p className="muted-copy">Semua pemain bergiliran memberi clue dan berdiskusi langsung. Aplikasi tidak merekam clue atau menentukan giliran.</p><SpokenClueTimer mode="round" key={`${game.public.round}-offline-clue`} deadlineAt={game.public.clueDeadlineAt} onExpire={finishClueRound} onFinish={finishClueRound} /></>}

        {game.public.phase === "discussion" && <><span className="section-kicker">DISKUSI TERBUKA</span><h2>Satukan <em>kecurigaanmu.</em></h2><p className="muted-copy">Bicarakan petunjuk secara langsung. Aplikasi tidak menyimpan isi clue.</p><button className="primary-button wide-button" onClick={() => act({ type: "finish-discussion" })}>Lanjut ke voting <span>→</span></button></>}

        {(game.public.phase === "voting" || game.public.phase === "revote") && <><span className="section-kicker">VOTING OFFLINE</span><h2>Konfirmasi <em>eliminasi.</em></h2><p className="muted-copy">Lakukan diskusi dan voting secara lisan. Setelah semua sepakat, pilih pemain yang keluar untuk memperbarui permainan.</p><div className="vote-list">{game.public.players.filter((player) => player.alive).map((player) => <button className={`vote-choice${eliminationCandidate === player.id ? " vote-choice-selected" : ""}`} key={player.id} aria-pressed={eliminationCandidate === player.id} onClick={() => setEliminationCandidate(player.id)}><span className="avatar-dot">{player.name.slice(0, 1).toUpperCase()}</span>{player.name}<span className="vote-arrow">{eliminationCandidate === player.id ? "✓" : "○"}</span></button>)}</div><button className="primary-button wide-button" disabled={!eliminationCandidate} onClick={confirmElimination}>Konfirmasi pemain tereliminasi <span>→</span></button></>}

        {game.public.phase === "mr-white-guess" && eliminated && whiteAssignment && <><span className="section-kicker">KESEMPATAN TERAKHIR</span><h2>Pemain <em>tereliminasi.</em></h2>{!privateOpen ? <div className="handoff-panel"><p>Serahkan perangkat kepada pemain yang tereliminasi. Ia mendapat satu kesempatan menebak kata Civilian.</p><button className="primary-button" onClick={() => setPrivateOpen(true)}>Buka kesempatan menebak <span>→</span></button></div> : <form className="action-form" onSubmit={(event) => { event.preventDefault(); act({ type: "guess-civilian-word", playerId: eliminated.id, guess: guessText }); }}><p className="white-callout">Tebak kata yang dimiliki para Civilian.</p><label className="field-label" htmlFor="white-guess">Tebakan kata Civilian</label><input id="white-guess" value={guessText} onChange={(event) => setGuessText(event.target.value)} maxLength={60} placeholder="Apa kata mereka?" /><button className="primary-button" type="submit">Kunci tebakan <span>→</span></button></form>}</>}

        {game.public.phase === "finished" && game.public.winner && <><span className="section-kicker">PERMAINAN SELESAI</span><h2 className="result-title">{game.public.winner === "civilian" ? "Civilian menang!" : game.public.winner === "undercover" ? "Undercover menang!" : "Mr. White menang!"}</h2><p className="muted-copy">{game.public.resultReason}</p><div className="reveal-results"><p>Kata Civilian <strong>{game.secret.civilianWord}</strong></p><p>Kata Undercover <strong>{game.secret.undercoverWord}</strong></p><div className="role-results">{game.secret.assignments.map((assignment) => <span key={assignment.playerId}>{game.public.players.find((player) => player.id === assignment.playerId)?.name}: <b>{ROLE_LABELS[assignment.role]}</b></span>)}</div></div><button className="primary-button wide-button" onClick={() => leave(UNDERCOVER_SETUP_PATH)}>Main lagi <span>↻</span></button></>}

        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </section>}
    <SiteFooter left="UNDERCOVER · PASS-AND-PLAY" right="Clue, diskusi, dan voting dilakukan secara lisan" />
  </main>;
}
