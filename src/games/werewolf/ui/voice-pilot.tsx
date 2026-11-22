"use client";

import "./werewolf.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { buildOnuwNightSequence } from "@/games/werewolf/engine/onuw/night-sequence";
import { ONUW_ROLE_INFO } from "@/games/werewolf/roles";
import { indonesianVoices, isSpeechSupported, loadVoices, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { CLASSIC_LINES, countWords, nightOrdinal, ONUW_LINES, ONUW_ROLE_LINES, renderLine, type ClassicLineKey } from "@/games/werewolf/voice/templates";

type Step = { text?: string; wait?: number };
const NIGHT_ROLES = ONUW_ROLES.filter((role) => ONUW_ROLE_LINES[role]);

/** Pilot page for the Indonesian voice moderator (Web Speech API). Not linked from the catalog yet. */
export default function VoicePilot() {
  const narrator = useMemo(() => new Narrator(), []);
  const runRef = useRef(0);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(0.95);
  const [pitch, setPitch] = useState(1);
  const [unlocked, setUnlocked] = useState(false);
  const [quick, setQuick] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [vars, setVars] = useState({ night: 1, victimCount: 2, winningFaction: "Warga Desa", minutes: 3 });
  const [deck, setDeck] = useState<OnuwRole[]>(["WEREWOLF", "MINION", "SEER", "ROBBER", "TROUBLEMAKER", "INSOMNIAC"]);

  useEffect(() => {
    let cancelled = false;
    const ok = isSpeechSupported();
    void loadVoices().then((list) => {
      if (cancelled) return;
      setSupported(ok);
      setVoices(list);
      setVoiceURI((current) => current || indonesianVoices(list)[0]?.voiceURI || "");
    });
    return () => { cancelled = true; narrator.cancel(); };
  }, [narrator]);

  useEffect(() => { narrator.setOptions({ voiceURI: voiceURI || null, rate, pitch }); }, [narrator, voiceURI, rate, pitch]);

  const idVoices = indonesianVoices(voices);
  const listedVoices = showAllVoices ? voices : idVoices;
  const lineVars = { nightOrdinal: nightOrdinal(vars.night), roleName: "Seer", victimCount: countWords(vars.victimCount), minutes: vars.minutes, winningFaction: vars.winningFaction };

  function render(template: string, extra: Record<string, string | number> = {}) {
    return renderLine(template, { ...lineVars, ...extra });
  }

  async function activate() {
    narrator.unlock();
    setUnlocked(true);
    await requestWakeLock();
  }

  function stop() {
    runRef.current += 1;
    narrator.cancel();
    setSubtitle("");
    setCountdown(null);
  }

  async function run(steps: Step[]) {
    stop();
    setError("");
    const id = runRef.current;
    for (const step of steps) {
      if (id !== runRef.current) return;
      if (step.text) {
        setSubtitle(step.text);
        await narrator.speak(step.text);
      }
      for (let left = step.wait ?? 0; left > 0; left -= 1) {
        if (id !== runRef.current) return;
        setCountdown(left);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setCountdown(null);
    }
    if (id === runRef.current) setSubtitle("");
  }

  function safeRun(build: () => Step[]) {
    try { void run(build()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Baris suara tidak valid."); }
  }

  function classicNight() {
    const turn = quick ? 3 : 15;
    return [
      { text: render(CLASSIC_LINES.NIGHT_INTRO), wait: quick ? 1 : 3 },
      ...["Werewolf", "Doctor", "Seer"].flatMap((roleName) => [
        { text: render(CLASSIC_LINES.NIGHT_TURN_START, { roleName }), wait: turn },
        { text: render(CLASSIC_LINES.NIGHT_TURN_END, { roleName }), wait: 1 },
      ]),
      { text: render(CLASSIC_LINES.DAWN_SINGLE_KILL), wait: 1 },
      { text: render(CLASSIC_LINES.DAY_START) },
    ];
  }

  function onuwNight() {
    const counts = Object.fromEntries(deck.map((role) => [role, 1])) as Partial<Record<OnuwRole, number>>;
    return buildOnuwNightSequence(counts).flatMap((step): Step[] => {
      if (step.key === "ONUW_START") return [{ text: ONUW_LINES.ONUW_START, wait: quick ? 2 : step.seconds }];
      if (step.key === "ONUW_DAY") return [{ text: render(ONUW_LINES.ONUW_DAY), wait: quick ? 3 : 5 }, { text: ONUW_LINES.ONUW_VOTE }];
      const line = ONUW_ROLE_LINES[step.key]!;
      return [{ text: line.open, wait: quick ? 3 : step.seconds }, { text: line.close, wait: 1 }];
    });
  }

  const setVar = (key: keyof typeof vars, value: string) => setVars((current) => ({ ...current, [key]: typeof current[key] === "number" ? Math.max(1, Number(value) || 1) : value }));

  return <main className="page-shell werewolf-theme">
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Pilot suara moderator</span></SiteHeader>
    <section className="ww-wrap">
      <Link className="text-button" href="/">← Kembali ke katalog</Link>
      <span className="section-kicker">WEREWOLF · PILOT SUARA</span>
      <h1>Moderator <em>suara.</em></h1>
      <p className="ww-muted">Suara dibuat langsung oleh browser (Web Speech API) memakai suara Bahasa Indonesia di perangkat ini. Kualitas tergantung browser: Edge (Microsoft Natural) dan Chrome (Google Bahasa Indonesia) biasanya paling jelas.</p>

      {supported === false && <p className="ww-alert" role="alert">Browser ini tidak mendukung Web Speech API.</p>}
      {supported && idVoices.length === 0 && <p className="ww-alert" role="alert">Tidak ada suara Bahasa Indonesia terpasang. Browser akan memakai suara bawaan dengan logat yang mungkin tidak pas; coba Chrome atau Edge, atau pasang paket suara Indonesia di sistem.</p>}

      <div className="ww-grid">
        <section className="ww-panel" aria-labelledby="voice-settings">
          <h2 id="voice-settings">Pengaturan suara</h2>
          <label className="ww-label" htmlFor="voice">Suara</label>
          <select id="voice" className="ww-input" value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)}>
            <option value="">Bawaan (id-ID)</option>
            {listedVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? "" : " · online"}</option>)}
          </select>
          <label className="ww-check"><input type="checkbox" checked={showAllVoices} onChange={(event) => setShowAllVoices(event.target.checked)} /> Tampilkan semua suara ({voices.length})</label>
          <label className="ww-label" htmlFor="rate">Kecepatan <span>{rate.toFixed(2)}×</span></label>
          <input id="rate" type="range" min={0.7} max={1.3} step={0.05} value={rate} onChange={(event) => setRate(Number(event.target.value))} />
          <label className="ww-label" htmlFor="pitch">Nada <span>{pitch.toFixed(2)}</span></label>
          <input id="pitch" type="range" min={0.7} max={1.3} step={0.05} value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
          <button className="ww-button ww-primary" onClick={() => void activate()} disabled={!supported}>{unlocked ? "Suara aktif ✓" : "Aktifkan suara"}</button>
          <label className="ww-check"><input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} /> Jeda singkat untuk uji cepat</label>
        </section>

        <section className="ww-panel" aria-labelledby="sample-vars">
          <h2 id="sample-vars">Variabel contoh</h2>
          <p className="ww-muted">Narator tidak pernah menyebut nama pemain, hanya role. Nama korban tampil di layar.</p>
          {([["night", "Malam ke"], ["victimCount", "Jumlah korban (banyak korban)"], ["winningFaction", "Kubu menang"], ["minutes", "Menit diskusi"]] as const).map(([key, label]) => <div key={key}>
            <label className="ww-label" htmlFor={`var-${key}`}>{label}</label>
            <input id={`var-${key}`} className="ww-input" type={typeof vars[key] === "number" ? "number" : "text"} min={1} value={vars[key]} onChange={(event) => setVar(key, event.target.value)} />
          </div>)}
        </section>
      </div>

      <section className="ww-panel ww-stage" aria-live="polite">
        <span className="section-kicker">SEDANG DIBACAKAN</span>
        <p className="ww-subtitle">{subtitle || "—"}</p>
        {countdown !== null && <time className="ww-countdown" aria-label={`${countdown} detik`}>{countdown}</time>}
        <div className="ww-actions">
          <button className="ww-button ww-primary" disabled={!supported} onClick={() => safeRun(classicNight)}>Simulasi malam Classic</button>
          <button className="ww-button ww-primary" disabled={!supported || deck.length === 0} onClick={() => safeRun(onuwNight)}>Simulasi malam ONUW</button>
          <button className="ww-button" onClick={stop}>Hentikan</button>
        </div>
        {error && <p className="ww-alert" role="alert">{error}</p>}
      </section>

      <section className="ww-panel" aria-labelledby="onuw-deck">
        <h2 id="onuw-deck">Role ONUW yang dipanggil</h2>
        <div className="ww-chips">{NIGHT_ROLES.map((role) => <label key={role} className="ww-chip"><input type="checkbox" checked={deck.includes(role)} onChange={(event) => setDeck((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role))} /> {ONUW_ROLE_INFO[role].name}</label>)}</div>
      </section>

      <section className="ww-panel" aria-labelledby="classic-lines">
        <h2 id="classic-lines">Baris narasi Classic</h2>
        <ul className="ww-lines">{(Object.keys(CLASSIC_LINES) as ClassicLineKey[]).map((key) => {
          let text = "";
          try { text = render(CLASSIC_LINES[key]); } catch (cause) { text = cause instanceof Error ? cause.message : ""; }
          return <li key={key}><button className="ww-play" aria-label={`Putar ${key}`} disabled={!supported} onClick={() => safeRun(() => [{ text: render(CLASSIC_LINES[key]) }])}>▶</button><span><code>{key}</code>{text}</span></li>;
        })}</ul>
      </section>
    </section>
    <SiteFooter left="WEREWOLF · PILOT" right="Suara Web Speech API · tanpa API key" />
  </main>;
}
