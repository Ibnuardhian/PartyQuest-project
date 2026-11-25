"use client";

import "./werewolf.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CatalogLink } from "@/components/site/catalog-link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { GameButton, GameCard, GameCardHeading, StepperGrid, StepperTile, ThemedSlider, ValidationBanner, type TileTone } from "@/components/ui/game-ui";
import { ONUW_MAX_PLAYERS, ONUW_MIN_PLAYERS, ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { deckSize, ONUW_CENTER_CARDS, validateOnuwSelections, type OnuwDeck, type OnuwMismatch } from "@/games/werewolf/engine/onuw/deck";
import { buildOnuwNightSequence, ONUW_ROLE_GAP_SECONDS } from "@/games/werewolf/engine/onuw/night-sequence";
import { onuwFinalCardOptions } from "@/games/werewolf/engine/onuw/final-cards";
import { nextOnuwQuestion, onuwKnownCards, onuwVerdict, resolveOnuwFacts, type OnuwAnswers, type OnuwVerdict } from "@/games/werewolf/engine/onuw/verdict";
import { onuwTeam, pendingHunters, type OnuwTeam } from "@/games/werewolf/engine/onuw/winner";
import { adjustOnuwDeck, onuwDeckRoles, ONUW_ROLE_MAX, recommendedOnuwDeck, validateOnuwNames } from "@/games/werewolf/engine/onuw/setup";
import { WEREWOLF_SETUP_PATH } from "@/games/werewolf/paths";
import { ONUW_ROLE_INFO } from "@/games/werewolf/roles";
import { loadVoiceConfig, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { onuwVoice, type VoiceLine } from "@/games/werewolf/voice/templates";
import { applyVoiceChoice, loadVoiceChoice } from "@/games/werewolf/voice/voice-choice";

const TEAM_TONE: Record<OnuwTeam, TileTone> = { werewolf: "danger", village: "ally", tanner: "neutral" };
const TEAM_LABEL: Record<OnuwTeam, string> = { werewolf: "Kubu Werewolf", village: "Kubu warga", tanner: "Tanner (sendiri)" };

type Phase = "setup" | "register" | "handoff" | "mismatch" | "repick" | "ready" | "night" | "day" | "vote" | "reveal" | "hunter" | "facts" | "end";

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
  /** Players with the most pointing fingers (indexes). */
  const [eliminated, setEliminated] = useState<number[]>([]);
  /** Final card of each dead player, read off the cards that are turned over (the other cards stay face down). */
  const [finalRoles, setFinalRoles] = useState<(OnuwRole | null)[]>([]);
  const dealt = picks.map((role) => role ?? "VILLAGER");
  const [dead, setDead] = useState<number[]>([]);
  const [shotHunters, setShotHunters] = useState<number[]>([]);
  /** Yes/no answers about cards that stay face down (only asked when the app cannot work them out). */
  const [answers, setAnswers] = useState<OnuwAnswers>({});
  const [verdict, setVerdict] = useState<OnuwVerdict | null>(null);
  const hunter = phase === "hunter" ? pendingHunters(finalRoles, dead, shotHunters)[0] : undefined;
  const deadCards = dead.flatMap((index) => finalRoles[index] ? [finalRoles[index]!] : []);
  const known = onuwKnownCards(deck, dealt, deadCards);
  const question = nextOnuwQuestion(known, answers);

  /**
   * Walks the result steps: every dead player's card, then each dead Hunter's target, then the yes/no
   * questions the cards cannot answer, then the winning team.
   */
  function settle(nextDead: number[], nextShot: number[], finals: (OnuwRole | null)[], nextAnswers: OnuwAnswers) {
    setDead(nextDead);
    setShotHunters(nextShot);
    setAnswers(nextAnswers);
    if (nextDead.some((index) => !finals[index])) { setPhase("reveal"); return; }
    if (pendingHunters(finals, nextDead, nextShot).length > 0) { setPhase("hunter"); return; }
    const cards = nextDead.map((index) => finals[index]!);
    const knownNow = onuwKnownCards(deck, dealt, cards);
    if (nextOnuwQuestion(knownNow, nextAnswers)) { setPhase("facts"); return; }
    setVerdict(onuwVerdict(cards, resolveOnuwFacts(knownNow, nextAnswers)));
    setPhase("end");
  }

  useEffect(() => {
    let cancelled = false;
    void loadVoiceConfig().then((config) => { if (!cancelled) applyVoiceChoice(narrator, loadVoiceChoice(config)); });
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

  /** Silent pause with no countdown ring, so the screen gives nothing away between roles. */
  async function pause(seconds: number, id: number) {
    await new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));
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
        setStepLabel("");
        if (!(await pause(ONUW_ROLE_GAP_SECONDS, id))) return;
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
    setDead([]);
    setShotHunters([]);
    setVerdict(null);
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
      <div className="ww-topline"><span className="topline-links"><Link className="text-button" href={WEREWOLF_SETUP_PATH}>← Werewolf</Link><CatalogLink /></span><span>MODE 2 · ONE NIGHT</span></div>

      {phase === "setup" && <GameCard aria-labelledby="onuw-deck-title">
        <GameCardHeading kicker="DECK KARTU FISIK" title="Atur deck" id="onuw-deck-title" description={<>Masukkan jumlah pemain dan kartu yang benar-benar dipakai: {playerCount} kartu dibagikan dan {ONUW_CENTER_CARDS} kartu tertutup di tengah meja.</>} />
        <ThemedSlider id="onuw-players" label="Jumlah pemain" value={playerCount} min={ONUW_MIN_PLAYERS} max={ONUW_MAX_PLAYERS} onChange={changePlayers} />
        <StepperGrid label="Kartu di deck">{ONUW_ROLES.map((role) => <StepperTile key={role} label={ONUW_ROLE_INFO[role].name} count={deck[role] ?? 0} max={ONUW_ROLE_MAX[role]} tone={TEAM_TONE[onuwTeam(role)]} toneLabel={TEAM_LABEL[onuwTeam(role)]} onChange={(next) => setDeck(adjustOnuwDeck(deck, role, next > (deck[role] ?? 0) ? 1 : -1))} />)}</StepperGrid>
        <ValidationBanner status={total === target ? "ok" : "warn"} detail={total === target ? "Siap dibagikan" : total < target ? `Tambah ${target - total} kartu lagi` : `Kurangi ${total - target} kartu`}>{total} dari {target} kartu</ValidationBanner>
        <ThemedSlider id="onuw-discussion" label="Diskusi siang" value={discussionMinutes} min={1} max={10} unit="menit" onChange={setDiscussionMinutes} />
        <GameButton variant="primary" wide type="button" disabled={total !== target} onClick={startRegistration}>Mulai pendaftaran (oper HP)</GameButton>
      </GameCard>}

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
        <p className="ww-muted">Ketuk pemain yang paling banyak ditunjuk (pilih semuanya jika seri). Jika setiap pemain hanya ditunjuk satu kali, tidak ada yang mati: lanjut tanpa memilih.</p>
        <div className="ww-targets">{names.map((name, index) => <button key={name} type="button" className={`ww-target${eliminated.includes(index) ? " is-selected" : ""}`} aria-pressed={eliminated.includes(index)} onClick={() => setEliminated((list) => list.includes(index) ? list.filter((item) => item !== index) : [...list, index])}>{name}</button>)}</div>
        <button type="button" className="ww-button ww-primary" onClick={() => { stopNarration(); const empty = picks.map(() => null); setFinalRoles(empty); settle(eliminated, [], empty, {}); }}>{eliminated.length ? "Lanjut: buka kartu yang mati" : "Tidak ada yang mati · lanjut"}</button>
      </div>}

      {phase === "reveal" && <div className="ww-panel">
        <span className="section-kicker">BUKA KARTU</span>
        <h2>Balik kartu pemain yang mati</h2>
        <p className="ww-muted">Hanya kartu pemain yang mati yang dibuka; kartu pemain lain tetap tertutup. Pilih kartu yang terbuka di depan mereka. Robber dan Troublemaker hanya menukar kartu antarpemain{dealt.includes("DRUNK") ? "; Drunk menukar kartunya dengan satu kartu tengah, jadi satu kartu tengah bisa muncul" : ", jadi pilihan hanya berisi kartu yang dibagikan ke pemain"}.</p>
        <button type="button" className="ww-button" onClick={() => setFinalRoles((list) => list.map((role, at) => dead.includes(at) ? dealt[at]! : role))}>Isi sesuai kartu awal</button>
        <ul className="ww-role-list">{dead.map((index) => <li key={names[index]}>
          <label htmlFor={`final-${index}`}>{names[index]} · mati<small className="ww-muted"> · awal: {ONUW_ROLE_INFO[dealt[index]!].name}</small></label>
          <select id={`final-${index}`} className="ww-input ww-final-card" value={finalRoles[index] ?? ""} onChange={(event) => setFinalRoles((list) => list.map((role, at) => at === index ? (event.target.value || null) as OnuwRole | null : role))}>
            <option value="">Pilih kartu…</option>
            {onuwFinalCardOptions(deck, dealt, finalRoles, index).map((role) => <option key={role} value={role}>{ONUW_ROLE_INFO[role].name}</option>)}
          </select>
        </li>)}</ul>
        <button type="button" className="ww-button ww-primary" disabled={dead.some((index) => !finalRoles[index])} onClick={() => settle(dead, shotHunters, finalRoles, answers)}>Lanjut</button>
      </div>}

      {phase === "hunter" && hunter !== undefined && <div className="ww-panel ww-center">
        <span className="section-kicker">HUNTER</span>
        <h2>{names[hunter]} adalah Hunter dan mati</h2>
        <p className="ww-muted">Hunter ikut membawa mati pemain yang ia tunjuk. Siapa yang ditunjuk {names[hunter]}?</p>
        <div className="ww-targets">{names.map((name, index) => index === hunter || dead.includes(index) ? null : <button key={name} type="button" className="ww-target" onClick={() => settle([...dead, index], [...shotHunters, hunter], finalRoles, answers)}>{name}</button>)}</div>
        <button type="button" className="ww-button" onClick={() => settle(dead, [...shotHunters, hunter], finalRoles, answers)}>Yang ditunjuk sudah mati / tidak ada</button>
      </div>}

      {phase === "facts" && question && <div className="ww-panel ww-center">
        <span className="section-kicker">SATU PERTANYAAN</span>
        <h2>{question === "WEREWOLF" ? "Adakah kartu Werewolf di depan pemain yang masih hidup?" : "Adakah kartu Minion di depan pemain yang masih hidup?"}</h2>
        <p className="ww-muted">Jawab dari kartu yang dipegang sekarang, termasuk setelah semua pertukaran malam. Kartu tengah meja tidak dihitung. Pertanyaan ini hanya muncul karena Drunk bisa memindahkan kartu; kalau ada yang ragu, balik saja kartu yang bersangkutan.</p>
        <button type="button" className="ww-button ww-primary" onClick={() => settle(dead, shotHunters, finalRoles, { ...answers, [question]: true })}>Ya, ada</button>
        <button type="button" className="ww-button" onClick={() => settle(dead, shotHunters, finalRoles, { ...answers, [question]: false })}>Tidak ada</button>
      </div>}

      {phase === "end" && verdict && <div className="ww-panel">
        <span className="section-kicker">PERMAINAN SELESAI</span>
        <h2>{[verdict.villageWins && "Warga desa menang", verdict.werewolfWins && "Tim Werewolf menang", verdict.tannerWins && "Tanner menang"].filter(Boolean).join(" · ") || "Tidak ada yang menang"}</h2>
        <p className="ww-muted">{verdict.reason}</p>
        <ul className="ww-role-list">{dead.length ? dead.map((index) => <li key={names[index]} className={verdict.tannerWins && finalRoles[index] === "TANNER" ? "is-winner" : ""}><span>{names[index]} ✝</span><strong>{ONUW_ROLE_INFO[finalRoles[index]!].name}{finalRoles[index] !== picks[index] && picks[index] ? ` (awal: ${ONUW_ROLE_INFO[picks[index]!].name})` : ""}{verdict.tannerWins && finalRoles[index] === "TANNER" ? " · MENANG" : ""}</strong></li>) : <li><span>Tidak ada yang mati.</span></li>}</ul>
        <button type="button" className="ww-button" onClick={() => { setDead(eliminated); setShotHunters([]); setAnswers({}); setPhase(eliminated.length ? "reveal" : "vote"); }}>Koreksi kartu</button>
        <button type="button" className="ww-button ww-primary" onClick={() => restart(true)}>Main lagi (pemain sama, kocok ulang)</button>
        <button type="button" className="ww-button" onClick={() => restart(false)}>Atur ulang deck</button>
      </div>}
    </section>
    <SiteFooter left="WEREWOLF · ONUW" right="Satu HP di tengah meja · kartu fisik" />
  </main>;
}
