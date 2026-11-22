"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Category, GameAction, GameState, Role } from "@/games/game-contract";
import { confirmOfflineElimination, finishOfflineClueRound, undercoverGame } from "@/games/undercover/engine";
import { clearLocalGameState, createLocalGameSession, LOCAL_GAME_PATH, readLocalGameSession, type LocalGameSession, writeLocalGameSession } from "@/games/undercover/local-session";
import { SpokenClueTimer } from "@/components/game/spoken-clue-timer";
import { ensureBrowserGuest, saveGuestProfile } from "@/lib/auth/browser-guest";

const CATEGORY_LABELS: Record<Category, string> = {
  campuran: "Campuran", makanan: "Makanan", hewan: "Hewan", benda: "Benda sehari-hari", tempat: "Tempat", pekerjaan: "Pekerjaan",
};
const ROLE_LABELS: Record<Role, string> = { civilian: "Civilian", undercover: "Undercover", "mr-white": "Mr. White" };
type SetupMode = "local" | "online";

export default function PartyQuestHome() {
  const router = useRouter();
  const pathname = usePathname();
  const [game, setGame] = useState<GameState | null>(null);
  const [savedSession, setSavedSession] = useState<LocalGameSession | null>(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupMode, setSetupMode] = useState<SetupMode>("local");
  const [namesInput, setNamesInput] = useState("Alya\nBima\nCitra");
  const [category, setCategory] = useState<Category>("campuran");
  const [undercoverCount, setUndercoverCount] = useState(1);
  const [mrWhiteEnabled, setMrWhiteEnabled] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [error, setError] = useState("");
  const [onlineName, setOnlineName] = useState("");
  const [onlineRoomCode, setOnlineRoomCode] = useState("");
  const [onlineReady, setOnlineReady] = useState(false);
  const [onlineWorking, setOnlineWorking] = useState(false);
  const [onlineMessage, setOnlineMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const restore = window.setTimeout(() => {
      void readLocalGameSession().then((session) => {
        if (cancelled) return;
        setSavedSession(session);
        setHasSavedGame(Boolean(session));
        if (new URLSearchParams(window.location.search).get("mode") === "online") {
          setSetupMode("online");
          setGame(null);
          setShowSetup(true);
          return;
        }
        if (pathname === LOCAL_GAME_PATH) {
          setSetupMode("local");
          const requestedHash = window.location.hash.slice(1);
          const matchesSession = session && (!requestedHash || requestedHash === session.hash);
          setGame(matchesSession ? session.state : null);
          setShowSetup(!matchesSession);
          if (matchesSession && !requestedHash) window.history.replaceState(window.history.state, "", `${LOCAL_GAME_PATH}#${session.hash}`);
        } else {
          setGame(null);
          setShowSetup(false);
        }
      });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(restore); };
  }, [pathname]);

  useEffect(() => {
    if (setupMode !== "online" || !showSetup) return;
    let cancelled = false;
    void ensureBrowserGuest().then(() => {
      if (!cancelled) setOnlineReady(true);
    }).catch((cause: unknown) => {
      if (!cancelled) setOnlineMessage(cause instanceof Error ? cause.message : "Koneksi Online Room belum siap.");
    });
    return () => { cancelled = true; };
  }, [setupMode, showSetup]);

  const playerCount = useMemo(() => namesInput.split(/\r?\n/).map((name) => name.trim()).filter(Boolean).length, [namesInput]);
  const currentPlayer = game?.public.players.find((player) => !game.public.revealedPlayerIds.includes(player.id));
  const currentAssignment = game && currentPlayer ? game.secret.assignments.find((item) => item.playerId === currentPlayer.id) : undefined;
  const [eliminationCandidate, setEliminationCandidate] = useState<string | null>(null);
  const eliminated = game?.public.eliminatedPlayerId ? game.public.players.find((player) => player.id === game.public.eliminatedPlayerId) : undefined;
  const whiteAssignment = game?.secret.assignments.find((item) => item.playerId === game.public.eliminatedPlayerId);

  async function startGame() {
    setError("");
    try {
      const names = namesInput.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
      const nextGame = undercoverGame.createInitialState(names, { category, undercoverCount, mrWhiteEnabled });
      const session = await createLocalGameSession(nextGame);
      setGame(nextGame);
      setEliminationCandidate(null);
      setSavedSession(session);
      const saved = writeLocalGameSession(session);
      setHasSavedGame(saved);
      if (!saved) setError("Browser tidak dapat menyimpan progres; permainan bisa hilang saat refresh.");
      router.push(`${LOCAL_GAME_PATH}#${session.hash}`);
      setPrivateOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permainan belum dapat dimulai.");
    }
  }

  function act(action: GameAction) {
    if (!game) return;
    setError("");
    try {
      const nextGame = undercoverGame.applyAction(game, action);
      setGame(nextGame);
      const nextSession = savedSession ? { ...savedSession, state: nextGame } : null;
      if (nextSession) setSavedSession(nextSession);
      const saved = nextSession ? writeLocalGameSession(nextSession) : false;
      setHasSavedGame(saved);
      if (!saved) setError("Permainan berjalan, tetapi browser tidak dapat menyimpan progres untuk refresh.");
      setPrivateOpen(false);
      setGuessText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi tidak dapat diproses.");
    }
  }

  function continueGame() {
    router.push(savedSession ? `${LOCAL_GAME_PATH}#${savedSession.hash}` : LOCAL_GAME_PATH);
  }

  function openOnlineSetup() {
    setSetupMode("online");
    setShowSetup(true);
    setGame(null);
    setPrivateOpen(false);
    if (setupMode !== "online") setOnlineReady(false);
    setOnlineMessage("");
    router.replace("/?mode=online");
  }

  function changeSetupMode(mode: SetupMode) {
    setSetupMode(mode);
    if (mode === "online" && setupMode !== "online") setOnlineReady(false);
    setError("");
    setOnlineMessage("");
    setShowSetup(true);
    if (mode === "online") router.replace("/?mode=online");
    else router.replace("/");
  }

  async function submitOnlineRoom(event: FormEvent<HTMLFormElement>, mode: "create" | "join") {
    event.preventDefault();
    setOnlineMessage("");
    setOnlineWorking(true);
    try {
      await ensureBrowserGuest();
      await saveGuestProfile(onlineName);
      const response = await fetch(mode === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create"
          ? { displayName: onlineName, settings: { category, undercoverCount, mrWhiteEnabled } }
          : { displayName: onlineName, code: onlineRoomCode }),
      });
      const payload = await response.json() as { data?: { code?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.code) throw new Error(payload.error?.message ?? "Room belum dapat diproses.");
      router.push(`/room/${payload.data.code}`);
    } catch (cause) {
      setOnlineMessage(cause instanceof Error ? cause.message : "Online Room belum dapat diakses.");
    } finally {
      setOnlineWorking(false);
    }
  }

  function saveOfflineState(nextGame: GameState) {
    setGame(nextGame);
    const nextSession = savedSession ? { ...savedSession, state: nextGame } : null;
    if (nextSession) setSavedSession(nextSession);
    const saved = nextSession ? writeLocalGameSession(nextSession) : false;
    setHasSavedGame(saved);
    if (!saved) setError("Permainan berjalan, tetapi browser tidak dapat menyimpan progres untuk refresh.");
    setPrivateOpen(false);
  }

  function finishClueRound() {
    if (!game) return;
    setError("");
    try {
      saveOfflineState(finishOfflineClueRound(game));
      setEliminationCandidate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ronde petunjuk tidak dapat diselesaikan.");
    }
  }

  function confirmElimination() {
    if (!game || !eliminationCandidate) return;
    setError("");
    try {
      saveOfflineState(confirmOfflineElimination(game, eliminationCandidate));
      setEliminationCandidate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Eliminasi tidak dapat dikonfirmasi.");
    }
  }

  function reset() {
    clearLocalGameState();
    setGame(null);
    setSavedSession(null);
    setHasSavedGame(false);
    setEliminationCandidate(null);
    setShowSetup(false);
    setPrivateOpen(false);
    setError("");
    router.replace("/");
  }

  return (
    <main className={`page-shell${pathname === LOCAL_GAME_PATH || showSetup || game ? " undercover-theme" : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="PartyQuest beranda"><span className="brand-mark">P</span>partyquest</Link>
        <div className="topbar-actions"><span className="topbar-note"><span className="live-dot" /> Kumpulan game untuk dimainkan bersama</span><button type="button" className="online-link" onClick={openOnlineSetup}>Online Room ↗</button></div>
      </header>

      {!game && !showSetup ? <section className="catalog-wrap" id="beranda">
        <div className="catalog-heading"><div className="eyebrow"><span>✦</span> PARTYQUEST · GAME BARENG</div><h1>Pilih game<br /><em>untuk dimainkan.</em></h1><p className="hero-description">Kumpulan permainan sosial untuk dimainkan bersama teman. Game baru akan ditambahkan di sini.</p></div>
        <div className="catalog-grid" aria-label="Katalog game">
          <article className="catalog-card catalog-featured catalog-undercover"><div className="catalog-art undercover-art"><span className="catalog-emblem" aria-hidden="true">✦</span><span className="art-tag">GAME PERTAMA</span><span className="art-title">UNDER<br />COVER</span><span className="art-subtitle">SATU KATA · BANYAK RAHASIA</span><span className="catalog-file-no" aria-hidden="true">FILE NO. 001</span></div><div className="catalog-card-body"><div className="catalog-meta"><span>TEBAK KATA</span><span>3–12 PEMAIN</span></div><h2>Undercover</h2><p>Temukan siapa yang mendapat kata berbeda lewat petunjuk lisan dan voting.</p><button className="primary-button" onClick={() => hasSavedGame ? continueGame() : setShowSetup(true)}>{hasSavedGame ? "Lanjutkan permainan" : "Pilih game"} <span>→</span></button>{hasSavedGame && <button className="text-button catalog-new-game" onClick={() => setShowSetup(true)}>Mulai permainan baru</button>}</div></article>
          {["Game berikutnya", "Game baru lainnya"].map((title, index) => <article className="catalog-card catalog-coming" key={title}><div className={`catalog-art coming-art coming-art-${index + 1}`}><span className="coming-symbol">{index === 0 ? "◇" : "✳"}</span><span className="art-tag">SEGERA HADIR</span></div><div className="catalog-card-body"><div className="catalog-meta"><span>GAME SOSIAL</span><span>DALAM PENGEMBANGAN</span></div><h2>{title}</h2><p>Lebih banyak permainan seru akan hadir di PartyQuest.</p><span className="coming-label">Segera hadir</span></div></article>)}
        </div>
      </section> : !game ? <section className="hero-grid" id="beranda">
        <div className="hero-copy">
          <button className="text-button catalog-back" onClick={() => { setSetupMode("local"); setShowSetup(false); router.replace("/"); }}>← Kembali ke katalog</button>
          <div className="eyebrow"><span>✦</span> GAME · UNDERCOVER</div>
          <h1>Seberapa jago<br />kamu <em>menyamar?</em></h1>
          <p className="hero-description">Semua punya kata rahasia—kecuali si penyamar. Beri petunjuk secara lisan, baca situasi, dan temukan siapa yang berbeda.</p>
          <div className="hero-facts"><span>👥 3–12 pemain</span><span>◷ 15–30 menit</span><span>▣ Satu perangkat</span></div>
          <div className="round-preview" aria-label="Ringkasan cara bermain">
            <div className="round-line" />
            {[ ["01", "Lihat kata", "Rahasiakan isi kartu"], ["02", "Beri petunjuk", "Jangan terlalu jelas"], ["03", "Cari penyamar", "Diskusi lalu voting"] ].map(([number, title, description]) => <div className="round-step" key={number}><span className="step-number">{number}</span><strong>{title}</strong><small>{description}</small></div>)}
          </div>
        </div>

        <section className="setup-card" aria-labelledby="setup-title">
          <div className="card-heading"><div><span className="section-kicker">{setupMode === "local" ? "MODE LOKAL" : "MODE ONLINE"}</span><h2 id="setup-title">{setupMode === "local" ? "Siapkan permainan" : "Buat atau gabung"}</h2></div><span className="card-icon">{setupMode === "local" ? "♧" : "⌁"}</span></div>
          <div className="setup-mode-switch" role="group" aria-label="Pilih mode permainan"><button type="button" className={setupMode === "local" ? "mode-option active" : "mode-option"} aria-pressed={setupMode === "local"} onClick={() => changeSetupMode("local")}>Pass-and-Play</button><button type="button" className={setupMode === "online" ? "mode-option active" : "mode-option"} aria-pressed={setupMode === "online"} onClick={() => changeSetupMode("online")}>Online Room</button></div>
          {setupMode === "local" ? <>
            <label className="field-label" htmlFor="player-names">Nama pemain <span>· satu nama per baris</span></label>
            <textarea id="player-names" className="names-input" value={namesInput} onChange={(event) => setNamesInput(event.target.value)} rows={5} maxLength={360} placeholder="Alya&#10;Bima&#10;Citra" />
            <div className="input-caption"><span>Minimal 3, maksimal 12 pemain</span><span className={playerCount >= 3 && playerCount <= 12 ? "count-ok" : "count-warning"}>{playerCount}/12</span></div>
            <div className="form-row">
              <div className="form-field"><label className="field-label" htmlFor="category">Kategori kata</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="form-field"><label className="field-label" htmlFor="undercover-count">Undercover</label><select id="undercover-count" value={undercoverCount} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{Array.from({ length: Math.min(4, Math.max(1, playerCount - Number(mrWhiteEnabled) - 2)) }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div>
            </div>
            <label className="toggle-row"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata—bisa menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
            <button className="primary-button" onClick={() => void startGame()}>Mulai permainan <span aria-hidden="true">→</span></button>
            {error && <p className="error-message" role="alert">{error}</p>}
            <p className="privacy-note"><span aria-hidden="true">◉</span> Kata akan dibuka bergiliran di perangkat ini. Pastikan pemain lain tidak mengintip.</p>
          </> : <>
            <label className="field-label" htmlFor="online-player-name">Nama tampilan</label><input className="text-input online-text-input" id="online-player-name" maxLength={24} value={onlineName} onChange={(event) => setOnlineName(event.target.value)} placeholder="Nama yang dilihat teman" />
            <form onSubmit={(event) => void submitOnlineRoom(event, "create")}><h3 className="subheading">Buat room baru</h3><div className="form-row"><div className="form-field"><label className="field-label" htmlFor="online-category">Kategori</label><select id="online-category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="form-field"><label className="field-label" htmlFor="online-undercover-count">Undercover</label><select id="online-undercover-count" value={undercoverCount} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{[1, 2, 3].map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div></div><label className="toggle-row"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata—bisa menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label><button className="primary-button" disabled={!onlineReady || onlineWorking || !onlineName.trim()}>Buat room <span>→</span></button></form>
            <div className="divider-label"><span />ATAU<span /></div>
            <form onSubmit={(event) => void submitOnlineRoom(event, "join")}><label className="field-label" htmlFor="online-join-code">Kode room</label><div className="join-row"><input className="text-input online-text-input code-input" id="online-join-code" maxLength={6} autoCapitalize="characters" value={onlineRoomCode} onChange={(event) => setOnlineRoomCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" /><button className="secondary-button" disabled={!onlineReady || onlineWorking || onlineRoomCode.length !== 6 || !onlineName.trim()}>Gabung</button></div></form>
            {!onlineReady && !onlineMessage && <p className="status-note">Menghubungkan sesi tamu…</p>}{onlineMessage && <p className="error-message" role="alert">{onlineMessage}</p>}
            <p className="privacy-note">Sesi tamu tidak memakai email atau kata sandi.</p>
          </>}
        </section>
      </section> : <section className="game-wrap">
        <div className="game-topline"><button className="text-button" onClick={reset}>← Keluar ke beranda</button><span>RONDE {game.public.round}</span></div>
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

          {game.public.phase === "finished" && game.public.winner && <><span className="section-kicker">PERMAINAN SELESAI</span><h2 className="result-title">{game.public.winner === "civilian" ? "Civilian menang!" : game.public.winner === "undercover" ? "Undercover menang!" : "Mr. White menang!"}</h2><p className="muted-copy">{game.public.resultReason}</p><div className="reveal-results"><p>Kata Civilian <strong>{game.secret.civilianWord}</strong></p><p>Kata Undercover <strong>{game.secret.undercoverWord}</strong></p><div className="role-results">{game.secret.assignments.map((assignment) => <span key={assignment.playerId}>{game.public.players.find((player) => player.id === assignment.playerId)?.name}: <b>{ROLE_LABELS[assignment.role]}</b></span>)}</div></div><button className="primary-button wide-button" onClick={reset}>Main lagi <span>↻</span></button></>}

          {error && <p className="error-message" role="alert">{error}</p>}
        </div>
      </section>}
      <footer className="footer"><span>PARTYQUEST <span className="footer-star">✦</span> MAIN BARENG, PILIH GAME</span><span>Undercover · game pertama di katalog</span></footer>
    </main>
  );
}

