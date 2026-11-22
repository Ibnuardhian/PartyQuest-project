"use client";

import "./werewolf.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { buildOnuwNightSequence } from "@/games/werewolf/engine/onuw/night-sequence";
import { ONUW_ROLE_INFO } from "@/games/werewolf/roles";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";
import { microsoftClipResolver, Narrator, requestWakeLock } from "@/games/werewolf/voice/narrator";
import { classicVoice, onuwVoice, VOICE_PACK, type VoiceLine } from "@/games/werewolf/voice/templates";

type Step = { line?: VoiceLine; wait?: number };
const MICROSOFT_VOICES = [{ id: "id-ID-ArdiNeural", label: "Ardi (laki-laki, sesuai voice pack)" }, { id: "id-ID-GadisNeural", label: "Gadis (perempuan)" }] as const;
const NIGHT_ROLES = ONUW_ROLES.filter((role) => VOICE_PACK.items.some((item) => item.key === `ONUW_${role}_OPEN`));
const ENGINE_LABELS = { pack: "Voice pack MP3 (Microsoft, statis)", microsoft: "Microsoft Edge Neural (dibuat server)", browser: "Suara browser (cadangan)" } as const;

/** Pilot page for the Werewolf voice moderator: static Microsoft voice pack + named announcements. */
export default function VoicePilot() {
  const narrator = useMemo(() => new Narrator(), []);
  const runRef = useRef(0);
  const [microsoftVoice, setMicrosoftVoice] = useState<string>(MICROSOFT_VOICES[0].id);
  const [unlocked, setUnlocked] = useState(false);
  const [quick, setQuick] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [engine, setEngine] = useState<keyof typeof ENGINE_LABELS | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [names, setNames] = useState({ victim: "Budi", victims: "Budi, Citra", hunter: "Dimas", executed: "Eka" });
  const [deck, setDeck] = useState<OnuwRole[]>(["WEREWOLF", "MINION", "SEER", "ROBBER", "TROUBLEMAKER", "INSOMNIAC"]);

  useEffect(() => () => narrator.cancel(), [narrator]);
  useEffect(() => { narrator.setClipResolver(microsoftClipResolver("/api/games/werewolf/tts/pilot", { voice: microsoftVoice })); }, [narrator, microsoftVoice]);

  async function activate() {
    narrator.unlock();
    setUnlocked(true);
    try { await ensureBrowserGuest(); } catch { setError("Sesi tamu belum siap; baris bernama akan memakai suara cadangan."); }
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
    if (!unlocked) await activate();
    const id = runRef.current;
    for (const step of steps) {
      if (id !== runRef.current) return;
      if (step.line) {
        setSubtitle(step.line.text);
        await narrator.speak(step.line);
        setEngine(narrator.lastEngine);
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

  const victims = names.victims.split(",").map((name) => name.trim()).filter(Boolean);
  const namedLines: Array<{ label: string; line: () => VoiceLine }> = [
    { label: "Satu korban", line: () => classicVoice.dawnKills([names.victim.trim()]) },
    { label: "Banyak korban", line: () => classicVoice.dawnKills(victims) },
    { label: "Pemburu", line: () => classicVoice.hunter(names.hunter.trim()) },
    { label: "Eksekusi", line: () => classicVoice.execution(names.executed.trim()) },
  ];

  function classicNight(): Step[] {
    const turn = quick ? 3 : 15;
    return [
      { line: classicVoice.nightIntro(), wait: quick ? 1 : 3 },
      ...(["WEREWOLF", "DOCTOR", "SEER"] as const).flatMap((role, index): Step[] => [
        ...(index > 0 ? [{ line: classicVoice.turnEnd() }] : []),
        { line: classicVoice.turnStart(role), wait: turn },
      ]),
      { line: classicVoice.dawnKills([names.victim.trim()]), wait: 1 },
      { line: classicVoice.dayStart() },
    ];
  }

  function onuwNight(): Step[] {
    const counts = Object.fromEntries(deck.map((role) => [role, 1])) as Partial<Record<OnuwRole, number>>;
    return buildOnuwNightSequence(counts).flatMap((step): Step[] => {
      if (step.key === "ONUW_START") return [{ line: onuwVoice.intro(), wait: quick ? 2 : step.seconds }];
      if (step.key === "ONUW_DAY") return [{ line: onuwVoice.dayStart(), wait: quick ? 3 : 5 }, { line: onuwVoice.voteCountdown() }];
      return [{ line: onuwVoice.open(step.key), wait: quick ? 3 : step.seconds }, { line: onuwVoice.close(step.key), wait: 1 }];
    });
  }

  return <main className="page-shell werewolf-theme">
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Pilot suara moderator</span></SiteHeader>
    <section className="ww-wrap">
      <Link className="text-button" href="/games/werewolf">← Kembali ke Werewolf</Link>
      <span className="section-kicker">WEREWOLF · PILOT SUARA</span>
      <h1>Moderator <em>suara.</em></h1>
      <p className="ww-muted">Semua baris memakai Microsoft Edge Neural. {VOICE_PACK.items.length} baris tanpa nama sudah berupa MP3 statis dari voice pack ({VOICE_PACK.voice}, kecepatan {VOICE_PACK.rate}, nada {VOICE_PACK.pitch}). Empat pengumuman siang yang menyebut nama pemain dibuat server saat dibutuhkan dengan suara yang sama; jika gagal, dipakai MP3 umum lalu suara browser.</p>

      <div className="ww-grid">
        <section className="ww-panel" aria-labelledby="voice-settings">
          <h2 id="voice-settings">Pengaturan</h2>
          <label className="ww-label" htmlFor="ms-voice">Suara untuk baris bernama</label>
          <select id="ms-voice" className="ww-input" value={microsoftVoice} onChange={(event) => setMicrosoftVoice(event.target.value)}>
            {MICROSOFT_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
          </select>
          <button className="ww-button ww-primary" onClick={() => void activate()}>{unlocked ? "Suara aktif ✓" : "Aktifkan suara"}</button>
          <label className="ww-check"><input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} /> Jeda singkat untuk uji cepat</label>
        </section>

        <section className="ww-panel" aria-labelledby="named-lines">
          <h2 id="named-lines">Pengumuman bernama</h2>
          {([["victim", "Korban"], ["victims", "Banyak korban (pisahkan koma)"], ["hunter", "Pemburu"], ["executed", "Dieksekusi"]] as const).map(([key, label]) => <div key={key}>
            <label className="ww-label" htmlFor={`name-${key}`}>{label}</label>
            <input id={`name-${key}`} className="ww-input" maxLength={key === "victims" ? 80 : 24} value={names[key]} onChange={(event) => setNames((current) => ({ ...current, [key]: event.target.value }))} />
          </div>)}
          <div className="ww-actions">{namedLines.map(({ label, line }) => <button key={label} className="ww-button" onClick={() => safeRun(() => [{ line: line() }])}>▶ {label}</button>)}</div>
        </section>
      </div>

      <section className="ww-panel ww-stage" aria-live="polite">
        <span className="section-kicker">SEDANG DIBACAKAN</span>
        <p className="ww-subtitle">{subtitle || "—"}</p>
        {engine && <span className="ww-muted">Sumber suara: {ENGINE_LABELS[engine]}</span>}
        {countdown !== null && <time className="ww-countdown" aria-label={`${countdown} detik`}>{countdown}</time>}
        <div className="ww-actions">
          <button className="ww-button ww-primary" onClick={() => safeRun(classicNight)}>Simulasi malam Classic</button>
          <button className="ww-button ww-primary" disabled={deck.length === 0} onClick={() => safeRun(onuwNight)}>Simulasi malam ONUW</button>
          <button className="ww-button" onClick={stop}>Hentikan</button>
        </div>
        {error && <p className="ww-alert" role="alert">{error}</p>}
      </section>

      <section className="ww-panel" aria-labelledby="onuw-deck">
        <h2 id="onuw-deck">Role ONUW yang dipanggil</h2>
        <div className="ww-chips">{NIGHT_ROLES.map((role) => <label key={role} className="ww-chip"><input type="checkbox" checked={deck.includes(role)} onChange={(event) => setDeck((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role))} /> {ONUW_ROLE_INFO[role].name}</label>)}</div>
      </section>

      {(["classic", "onuw"] as const).map((mode) => <section key={mode} className="ww-panel" aria-labelledby={`pack-${mode}`}>
        <h2 id={`pack-${mode}`}>Voice pack · {mode === "classic" ? "Mode 1 Classic" : "Mode 2 ONUW"}</h2>
        <ul className="ww-lines">{VOICE_PACK.items.filter((item) => item.mode === mode).map((item) => <li key={item.key}>
          <button className="ww-play" aria-label={`Putar ${item.key}`} onClick={() => safeRun(() => [{ line: { text: item.text, clip: item.file } }])}>▶</button>
          <span><code>{item.file.replace("/audio/werewolf/", "")}</code>{item.text}</span>
        </li>)}</ul>
      </section>)}
    </section>
    <SiteFooter left="WEREWOLF · PILOT" right="Microsoft Edge Neural · cadangan suara browser" />
  </main>;
}
