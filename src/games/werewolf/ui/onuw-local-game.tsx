"use client";

import "./werewolf.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { ONUW_MAX_PLAYERS, ONUW_MIN_PLAYERS, ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { deckSize, ONUW_CENTER_CARDS, validateOnuwSelections, type OnuwDeck, type OnuwMismatch } from "@/games/werewolf/engine/onuw/deck";
import { buildOnuwNightSequence } from "@/games/werewolf/engine/onuw/night-sequence";
import { adjustOnuwDeck, onuwDeckRoles, ONUW_ROLE_MAX, recommendedOnuwDeck, validateOnuwNames } from "@/games/werewolf/engine/onuw/setup";
import { WEREWOLF_SETUP_PATH } from "@/games/werewolf/paths";
import { ONUW_ROLE_INFO } from "@/games/werewolf/roles";
import { loadVoiceConfig, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { onuwVoice, type VoiceLine } from "@/games/werewolf/voice/templates";

type Phase = "setup" | "register" | "handoff" | "mismatch" | "repick" | "ready" | "night" | "day" | "vote" | "end";

/**
 * Mode 2: One Night Ultimate Werewolf with physical cards and one shared phone (docs/01 §4).
 * Everything stays on this device; the phone validates picks and narrates the night.
 */
export default function OnuwLocalGame() {
  const narrator = useMemo(() => new Narrator(), []);
  const runRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerCount, setPlayerCount] = useState(5);
  const [deck, setDeck] = useState<OnuwDeck>(() => recommendedOnuwDeck(5));
  const [discussionMinutes, setDiscussionMinutes] = useState(5);
  const [names, setNames] = useState<string[]>([]);
  const [picks, setPicks] = useState<(OnuwRole | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState<OnuwRole | null>(null);
  const [repicked, setRepicked] = useState<boolean[]>([]);
  const [mismatches, setMismatches] = useState<OnuwMismatch[]>([]);
  const [message, setMessage] = useState("");
  const [stepLabel, setStepLabel] = useState("");
  const [countdown, setCountdown] = useState<{ left: number; total: number } | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadVoiceConfig().then((config) => { if (!cancelled && config) narrator.setStaticBase(config.staticBase); });
    return () => { cancelled = true; runRef.current += 1; narrator.cancel(); };
  }, [narrator]);

  const total = deckSize(deck);
  const target = playerCount + ONUW_CENTER_CARDS;
  const roles = onuwDeckRoles(deck);

  function changePlayers(next: number) {
    const count = Math.max(ONUW_MIN_PLAYERS, Math.min(ONUW_MAX_PLAYERS, next));
    setPlayerCount(count);
    setDeck(recommendedOnuwDeck(count));
  }

  function startRegistration() {
    setNames(Array.from({ length: playerCount }, () => ""));
    setPicks(Array.from({ length: playerCount }, () => null));
    setCurrent(0);
    setDraftName("");
    setDraftRole(null);
    setMessage("");
    setPhase("register");
  }

  function confirmRegistration() {
    const name = draftName.trim();
    const nextNames = names.map((value, index) => index === current ? name : value);
    const error = validateOnuwNames(nextNames.slice(0, current + 1));
    if (error) { setMessage(error); return; }
    if (!draftRole) { setMessage("Pilih kartu yang ada di tanganmu."); return; }
    const nextPicks = picks.map((value, index) => index === current ? draftRole : value);
    setNames(nextNames);
    setPicks(nextPicks);
    setMessage("");
    setDraftName("");
    setDraftRole(null);
    if (current + 1 < playerCount) {
      setCurrent(current + 1);
      setPhase("handoff");
    } else {
      validate(nextPicks);
    }
  }

  function validate(selection: (OnuwRole | null)[]) {
    const result = validateOnuwSelections(deck, selection.filter((role): role is OnuwRole => role !== null), playerCount);
    if (result.valid) {
      setPhase("ready");
      return;
    }
    setMismatches(result.mismatches);
    setPhase("mismatch");
  }

  function startRepick() {
    setRepicked(Array.from({ length: playerCount }, () => false));
    setPicks(Array.from({ length: playerCount }, () => null));
    setCurrent(-1);
    setDraftRole(null);
    setPhase("repick");
  }

  function confirmRepick() {
    if (current < 0 || !draftRole) return;
    const nextPicks = picks.map((value, index) => index === current ? draftRole : value);
    const nextDone = repicked.map((value, index) => index === current ? true : value);
    setPicks(nextPicks);
    setRepicked(nextDone);
    setCurrent(-1);
    setDraftRole(null);
    if (nextDone.every(Boolean)) validate(nextPicks);
  }

  async function speak(line: VoiceLine, id: number) {
    if (id !== runRef.current) return false;
    setStepLabel(line.text);
    await narrator.speak(line);
    return id === runRef.current;
  }

  async function wait(seconds: number, id: number) {
    for (let left = seconds; left > 0; left -= 1) {
      if (id !== runRef.current) return false;
      setCountdown({ left, total: seconds });
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    setCountdown(null);
    return id === runRef.current;
  }

  async function runNight() {
    narrator.unlock();
    await requestWakeLock();
    const id = ++runRef.current;
    setPhase("night");
    for (const step of buildOnuwNightSequence(deck)) {
      if (step.key === "ONUW_START") {
        if (!(await speak(onuwVoice.intro(), id)) || !(await wait(step.seconds, id))) return;
      } else if (step.key === "ONUW_DAY") {
        if (!(await speak(onuwVoice.dayStart(), id))) return;
      } else {
        if (!(await speak(onuwVoice.open(step.key), id)) || !(await wait(step.seconds, id)) || !(await speak(onuwVoice.close(step.key), id))) return;
      }
    }
    if (id !== runRef.current) return;
    setPhase("day");
    if (!(await wait(discussionMinutes * 60, id))) return;
    await finishDay(id);
  }

  async function finishDay(id = ++runRef.current) {
    setCountdown(null);
    setPhase("vote");
    await speak(onuwVoice.voteCountdown(), id);
  }

  function stopNarration() {
    runRef.current += 1;
    narrator.cancel();
    setCountdown(null);
  }

  function restart(keepPlayers: boolean) {
    stopNarration();
    setEliminated([]);
    if (keepPlayers) {
      setPicks(Array.from({ length: playerCount }, () => null));
      startRepick();
    } else {
      setPhase("setup");
    }
  }

  const ring = countdown ? { background: `conic-gradient(#0ea5e959 ${(countdown.left / countdown.total) * 360}deg, #1e293b 0deg)` } : undefined;
  const roleButtons = <div className="ww-targets">{roles.map((role) => <button key={role} type="button" className={`ww-target${draftRole === role ? " is-selected" : ""}`} aria-pressed={draftRole === role} onClick={() => setDraftRole(role)}>
    <span>{ONUW_ROLE_INFO[role].name}</span>
  </button>)}</div>;

  return <main className={`page-shell werewolf-theme${phase === "night" ? " ww-is-night" : ""}`}>
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Werewolf · ONUW satu HP</span></SiteHeader>
    <section className="ww-game">
      <div className="ww-topline"><Link className="text-button" href={WEREWOLF_SETUP_PATH}>← Werewolf</Link><span>MODE 2 · ONE NIGHT</span></div>

      {phase === "setup" && <div className="ww-panel">
        <span className="section-kicker">DECK KARTU FISIK</span>
        <h2>Atur deck</h2>
        <p className="ww-muted">Masukkan jumlah pemain dan kartu yang benar-benar dipakai: {playerCount} kartu dibagikan dan {ONUW_CENTER_CARDS} kartu tertutup di tengah meja.</p>
        <label className="ww-label" htmlFor="onuw-players">Jumlah pemain <span>{playerCount}</span></label>
        <input id="onuw-players" type="range" min={ONUW_MIN_PLAYERS} max={ONUW_MAX_PLAYERS} value={playerCount} onChange={(event) => changePlayers(Number(event.target.value))} />
        <ul className="ww-onuw-deck">{ONUW_ROLES.map((role) => <li key={role}>
          <span>{ONUW_ROLE_INFO[role].name}</span>
          <span className="ww-onuw-stepper">
            <button type="button" aria-label={`Kurangi ${ONUW_ROLE_INFO[role].name}`} disabled={(deck[role] ?? 0) === 0} onClick={() => setDeck(adjustOnuwDeck(deck, role, -1))}>−</button>
            <strong>{deck[role] ?? 0}</strong>
            <button type="button" aria-label={`Tambah ${ONUW_ROLE_INFO[role].name}`} disabled={(deck[role] ?? 0) >= ONUW_ROLE_MAX[role]} onClick={() => setDeck(adjustOnuwDeck(deck, role, 1))}>+</button>
          </span>
        </li>)}</ul>
        <p className={total === target ? "ww-muted" : "ww-warning"}>{total} dari {target} kartu{total === target ? " ✓" : ` — harus tepat ${target}`}</p>
        <label className="ww-label" htmlFor="onuw-discussion">Diskusi siang <span>{discussionMinutes} menit</span></label>
        <input id="onuw-discussion" type="range" min={1} max={10} value={discussionMinutes} onChange={(event) => setDiscussionMinutes(Number(event.target.value))} />
        <button type="button" className="ww-button ww-primary" disabled={total !== target} onClick={startRegistration}>Mulai pendaftaran (oper HP)</button>
      </div>}

      {phase === "register" && <div className="ww-panel">
        <span className="section-kicker">PEMAIN {current + 1} DARI {playerCount}</span>
        <h2>Daftar &amp; pilih kartumu</h2>
        <label className="ww-label" htmlFor="onuw-name">Nama</label>
        <input id="onuw-name" className="ww-input" maxLength={24} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Namamu" autoComplete="off" />
        <p className="ww-muted">Ketuk kartu yang sama dengan kartu fisik di tanganmu. Semua kartu selalu ditampilkan.</p>
        {roleButtons}
        <button type="button" className="ww-button ww-primary" disabled={!draftName.trim() || !draftRole} onClick={confirmRegistration}>Simpan</button>
        {message && <p className="ww-alert" role="alert">{message}</p>}
      </div>}

      {phase === "handoff" && <div className="ww-panel ww-center">
        <span className="section-kicker">TERSIMPAN</span>
        <h2>Serahkan HP</h2>
        <p className="ww-muted">Berikan HP ke pemain berikutnya ({current + 1} dari {playerCount}).</p>
        <button type="button" className="ww-button ww-primary" onClick={() => setPhase("register")}>Saya pemain berikutnya</button>
      </div>}

      {phase === "mismatch" && <div className="ww-panel">
        <span className="section-kicker">PERIKSA ULANG</span>
        <h2>Terjadi ketidaksesuaian jumlah kartu role!</h2>
        <ul className="ww-role-list">{mismatches.map((item) => <li key={item.role}><span>{ONUW_ROLE_INFO[item.role].name}</span><strong>dipilih {item.selected}, di deck {item.available}</strong></li>)}</ul>
        <p className="ww-muted">Semua pemain memilih ulang kartunya. Nama yang sudah terdaftar tetap disimpan.</p>
        <button type="button" className="ww-button ww-primary" onClick={startRepick}>Pilih ulang</button>
      </div>}

      {phase === "repick" && <div className="ww-panel">
        <span className="section-kicker">PILIH ULANG · {repicked.filter(Boolean).length}/{playerCount}</span>
        {current < 0 ? <>
          <h2>Ketuk namamu</h2>
          <div className="ww-targets">{names.map((name, index) => <button key={name} type="button" className="ww-target" disabled={repicked[index]} onClick={() => { setCurrent(index); setDraftRole(null); }}>{name}{repicked[index] ? " ✓" : ""}</button>)}</div>
        </> : <>
          <h2>{names[current]}, pilih kartumu</h2>
          {roleButtons}
          <button type="button" className="ww-button ww-primary" disabled={!draftRole} onClick={confirmRepick}>Simpan</button>
        </>}
      </div>}

      {phase === "ready" && <div className="ww-panel ww-center">
        <span className="section-kicker">DECK COCOK ✓</span>
        <h2>Letakkan HP di tengah meja</h2>
        <p className="ww-muted">Semua pemain menutup mata. Narator memanggil setiap role yang ada di deck, termasuk kartu yang mungkin ada di tengah.</p>
        <button type="button" className="ww-button ww-primary" onClick={() => void runNight()}>Mulai malam (aktifkan suara)</button>
      </div>}

      {phase === "night" && <div className="ww-onuw-night" aria-live="polite">
        <span className="ww-onuw-moon" aria-hidden="true" />
        {countdown && <div className="ww-onuw-ring" style={ring}><time aria-label={`${countdown.left} detik`}>{countdown.left}</time></div>}
        <p className="ww-night-hint">{stepLabel}</p>
        <button type="button" className="ww-button" onClick={() => { stopNarration(); setPhase("ready"); }}>Hentikan malam</button>
      </div>}

      {phase === "day" && <div className="ww-panel ww-center">
        <span className="section-kicker">PAGI · DISKUSI</span>
        <h2>Temukan Werewolf!</h2>
        {countdown && <div className="ww-onuw-ring" style={ring}><time aria-label={`${countdown.left} detik`}>{Math.floor(countdown.left / 60)}:{String(countdown.left % 60).padStart(2, "0")}</time></div>}
        <button type="button" className="ww-button ww-primary" onClick={() => void finishDay()}>Selesai diskusi · hitung mundur</button>
      </div>}

      {phase === "vote" && <div className="ww-panel ww-center">
        <span className="section-kicker">TUNJUK SEKARANG</span>
        <h2>Tiga… dua… satu… tunjuk!</h2>
        <p className="ww-muted">Opsional: catat siapa yang tertunjuk paling banyak.</p>
        <div className="ww-targets">{names.map((name) => <button key={name} type="button" className={`ww-target${eliminated.includes(name) ? " is-selected" : ""}`} aria-pressed={eliminated.includes(name)} onClick={() => setEliminated((list) => list.includes(name) ? list.filter((item) => item !== name) : [...list, name])}>{name}</button>)}</div>
        <button type="button" className="ww-button ww-primary" onClick={() => { stopNarration(); setPhase("end"); }}>Selesai</button>
      </div>}

      {phase === "end" && <div className="ww-panel">
        <span className="section-kicker">PERMAINAN SELESAI</span>
        <h2>{eliminated.length ? `Tereliminasi: ${eliminated.join(", ")}` : "Tidak ada yang dicatat"}</h2>
        <p className="ww-muted">Buka kartu fisik masing-masing (posisinya mungkin sudah ditukar di malam hari) untuk menentukan pemenang.</p>
        <ul className="ww-role-list">{names.map((name, index) => <li key={name}><span>{name}</span><strong>kartu awal: {picks[index] ? ONUW_ROLE_INFO[picks[index]!].name : "—"}</strong></li>)}</ul>
        <button type="button" className="ww-button ww-primary" onClick={() => restart(true)}>Main lagi (pemain sama, kocok ulang)</button>
        <button type="button" className="ww-button" onClick={() => restart(false)}>Atur ulang deck</button>
      </div>}
    </section>
    <SiteFooter left="WEREWOLF · ONUW" right="Satu HP di tengah meja · kartu fisik" />
  </main>;
}
