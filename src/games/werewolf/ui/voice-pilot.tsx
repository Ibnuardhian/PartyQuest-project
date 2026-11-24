"use client";

import "./werewolf.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { ONUW_ROLES, type OnuwRole } from "@/games/werewolf/contract";
import { buildOnuwNightSequence } from "@/games/werewolf/engine/onuw/night-sequence";
import { ONUW_ROLE_INFO } from "@/games/werewolf/roles";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";
import { loadVoiceConfig, microsoftClipResolver, Narrator, requestWakeLock, type ClipResolver, type VoiceConfig } from "@/games/werewolf/voice/narrator";
import { loadVoiceChoice, saveVoiceChoice } from "@/games/werewolf/voice/voice-choice";
import { ACTIVE_PRESET, classicVoice, onuwVoice, VOICE_PACK, VOICE_PRESETS, type VoiceLine, type VoicePresetId } from "@/games/werewolf/voice/templates";

type Step = { line?: VoiceLine; wait?: number; preset?: VoicePresetId; label?: string };
const PRESET_IDS = Object.keys(VOICE_PRESETS) as VoicePresetId[];
const BILINGUAL = VOICE_PACK.bilingual;
const BILINGUAL_SAMPLES = VOICE_PACK.items.filter((item) => BILINGUAL.sampleKeys.includes(item.key));
/** Indonesian-heavy line voiced by en-US-BrianMultilingualNeural (samples/brian, generated on request). */
const BRIAN_SAMPLE = VOICE_PACK.items.find((item) => item.key === "ONUW_SEER_OPEN")!;
/** Named announcement voiced by Brian (samples/brian/classic/dawn_single_kill_named.mp3). */
const BRIAN_NAMED_TEXT = classicVoice.dawnKills(["Budi"]).text;
const MICROSOFT_VOICES = [{ id: "id-ID-ArdiNeural", label: "Ardi (laki-laki, sesuai voice pack)" }, { id: "id-ID-GadisNeural", label: "Gadis (perempuan)" }] as const;
const NIGHT_ROLES = ONUW_ROLES.filter((role) => VOICE_PACK.items.some((item) => item.key === `ONUW_${role}_OPEN`));
const ENGINE_LABELS = { pack: "Voice pack MP3 (statis)", microsoft: "Dibuat server (Microsoft atau ElevenLabs)", browser: "Suara browser (cadangan)" } as const;

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
  const [preset, setPreset] = useState<VoicePresetId>(ACTIVE_PRESET);
  const [effects, setEffects] = useState(VOICE_PACK.dramaticEffects);
  const resolvers = useRef(new Map<string, ClipResolver>());
  const [provider, setProvider] = useState<"microsoft" | "elevenlabs">("microsoft");
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  /** true = saved, false = unsaved change, null = storage refused. */
  const [saved, setSaved] = useState<boolean | null>(false);

  useEffect(() => {
    let cancelled = false;
    void loadVoiceConfig().then((loaded) => {
      if (cancelled) return;
      setConfig(loaded);
      const choice = loadVoiceChoice(loaded);
      setProvider(choice.provider);
      setEffects(choice.effects);
    });
    return () => { cancelled = true; narrator.cancel(); };
  }, [narrator]);
  useEffect(() => { narrator.setEffects(effects); }, [narrator, effects]);

  /** One cached resolver per provider + voice + preset, so comparisons reuse generated audio. */
  function resolverFor(presetId: VoicePresetId) {
    const key = `${provider}|${microsoftVoice}|${presetId}`;
    let resolver = resolvers.current.get(key);
    if (!resolver) {
      resolver = microsoftClipResolver("/api/games/werewolf/tts/pilot", { provider, voice: microsoftVoice, preset: presetId });
      resolvers.current.set(key, resolver);
    }
    return resolver;
  }

  const elevenLabsPack = provider === "elevenlabs" && Boolean(config?.elevenLabsPackReady);

  /**
   * Static clips are used when they match the chosen provider and preset; otherwise the line is
   * rendered on demand (the static clip stays as the fallback).
   */
  function adapt(line: VoiceLine, presetId: VoicePresetId): VoiceLine {
    if (!line.clip) return line;
    const staticMatches = provider === "elevenlabs" ? elevenLabsPack : presetId === ACTIVE_PRESET;
    return staticMatches ? line : { text: line.text, fallbackClip: line.clip };
  }

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
        const stepPreset = step.preset ?? preset;
        narrator.setClipResolver(resolverFor(stepPreset));
        narrator.setStaticBase(elevenLabsPack ? "/audio/werewolf/elevenlabs/" : "/audio/werewolf/");
        // Same rule as the game: with the ElevenLabs pack, named announcements use the nameless clip.
        narrator.setNamedLines(elevenLabsPack ? "generic" : "tts");
        setSubtitle(step.label ? `[${step.label}] ${step.line.text}` : step.line.text);
        await narrator.speak(adapt(step.line, stepPreset));
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

  /** Plays a bilingual comparison sample (or the current pack file) exactly as generated. */
  async function playSample(url: string, text: string, label: string) {
    stop();
    setError("");
    if (!unlocked) await activate();
    narrator.setStaticBase("/audio/werewolf/");
    setSubtitle(`[${label}] ${text}`);
    if (!(await narrator.speak({ text, clip: url })) || narrator.lastEngine !== "pack") {
      setError("Sampel belum dibuat. Jalankan: docker compose run --rm --no-deps web npm run voice:generate -- --samples --bilingual segments (lalu multilingual).");
    }
    setEngine(narrator.lastEngine);
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
      <p className="ww-muted">Pilih suara di bawah, dengarkan, lalu simpan di HP host atau TV yang akan menjadi narator. Kedua pilihan memakai {VOICE_PACK.items.length} MP3 siap pakai; jika gagal, dipakai suara browser.</p>

      <div className="ww-grid">
        <section className="ww-panel" aria-labelledby="voice-settings">
          <h2 id="voice-settings">Pilih suara moderator</h2>
          <p className="ww-muted">Pilihan disimpan di perangkat ini dan dipakai saat perangkat ini menjadi narator (HP host atau layar TV).</p>
          <fieldset className="ww-radio-group">
            <legend>1 · Suara</legend>
            <label className="ww-radio"><input type="radio" name="voice-provider" checked={provider === "microsoft"} onChange={() => { setProvider("microsoft"); setSaved(false); }} /><span><strong>Microsoft · Ardi</strong><small>Gratis. Pengumuman siang menyebut nama pemain.</small></span></label>
            <label className="ww-radio"><input type="radio" name="voice-provider" checked={provider === "elevenlabs"} disabled={!config?.elevenLabsPackReady} onChange={() => { setProvider("elevenlabs"); setSaved(false); }} /><span><strong>ElevenLabs · Adam</strong><small>{config?.elevenLabsPackReady ? "Lebih dramatis dengan emosi (sedih, tawa jahat). Tidak menyebut nama pemain." : "Voice pack Adam belum tersedia di server ini."}</small></span></label>
          </fieldset>
          <fieldset className="ww-radio-group">
            <legend>2 · Efek dramatis</legend>
            <label className="ww-radio"><input type="radio" name="voice-effects" checked={!effects} onChange={() => { setEffects(false); setSaved(false); }} /><span><strong>Mati</strong><small>Suara bersih.</small></span></label>
            <label className="ww-radio"><input type="radio" name="voice-effects" checked={effects} onChange={() => { setEffects(true); setSaved(false); }} /><span><strong>Nyala</strong><small>Gema ruangan dan bass tebal.</small></span></label>
          </fieldset>
          <div className="ww-actions">
            <button className="ww-button" onClick={() => safeRun(() => [{ line: classicVoice.nightIntro(), wait: 1 }, { line: classicVoice.dawnKills([names.victim.trim() || "Budi"]) }])}>▶ Dengarkan pilihan ini</button>
            <button className="ww-button ww-primary" onClick={() => setSaved(saveVoiceChoice({ provider, effects }) ? true : null)}>{saved ? "Tersimpan ✓" : "Simpan untuk perangkat ini"}</button>
          </div>
          {saved === null && <p className="ww-alert" role="alert">Browser ini menolak penyimpanan lokal; pilihan tidak tersimpan.</p>}
          <label className="ww-check"><input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} /> Jeda singkat untuk uji cepat</label>
          <details className="ww-details">
            <summary>Eksperimen Microsoft (hanya untuk mendengar, belum dipakai di game)</summary>
            <fieldset className="ww-radio-group">
              <legend>Karakter suara</legend>
              {PRESET_IDS.map((id) => <label key={id} className="ww-radio"><input type="radio" name="voice-preset" checked={preset === id} disabled={provider === "elevenlabs"} onChange={() => setPreset(id)} /><span><strong>{VOICE_PRESETS[id].label}{id === ACTIVE_PRESET ? " · dipakai game" : ""}</strong><small>kecepatan {VOICE_PRESETS[id].rate}, nada {VOICE_PRESETS[id].pitch}</small></span></label>)}
            </fieldset>
            <fieldset className="ww-radio-group">
              <legend>Penutur</legend>
              {MICROSOFT_VOICES.map((voice) => <label key={voice.id} className="ww-radio"><input type="radio" name="voice-speaker" checked={microsoftVoice === voice.id} disabled={provider === "elevenlabs"} onChange={() => setMicrosoftVoice(voice.id)} /><span><strong>{voice.label}</strong></span></label>)}
            </fieldset>
            <button className="ww-button" disabled={provider === "elevenlabs"} onClick={() => safeRun(() => PRESET_IDS.map((id) => ({ line: classicVoice.nightIntro(), preset: id, label: VOICE_PRESETS[id].label, wait: 1 })))}>▶ Bandingkan semua karakter</button>
            <p className="ww-muted">Game memakai voice pack {VOICE_PRESETS[ACTIVE_PRESET].label}. Untuk mengganti karakter di game, buat ulang pack: <code>TTS_PRESET=&lt;karakter&gt; npm run voice:generate -- --force</code>.</p>
          </details>
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

      <details className="ww-panel ww-details" aria-labelledby="bilingual">
        <summary><h2 id="bilingual">Sampel lain: pelafalan nama role (Microsoft)</h2></summary>
        <p className="ww-muted">Bandingkan cara nama role diucapkan. <strong>Sekarang</strong>: Ardi membaca semuanya. <strong>Segmen</strong>: Ardi untuk bahasa Indonesia, {BILINGUAL.englishVoice} untuk nama role, digabung jadi satu MP3. <strong>Multibahasa</strong>: {BILINGUAL.multilingualVoice} membaca seluruh kalimat.</p>
        <ul className="ww-lines">{BILINGUAL_SAMPLES.map((item) => <li key={item.key}>
          <span className="ww-sample-buttons">
            <button className="ww-button" onClick={() => void playSample(item.file, item.text, "Sekarang")}>Sekarang</button>
            <button className="ww-button" onClick={() => void playSample(item.file.replace("/audio/werewolf/", "/audio/werewolf/samples/segments/"), item.text, "Segmen")}>Segmen</button>
            <button className="ww-button" onClick={() => void playSample(item.file.replace("/audio/werewolf/", "/audio/werewolf/samples/multilingual/"), item.text, "Multibahasa")}>Multibahasa</button>
          </span>
          <span>{item.text}</span>
        </li>)}
        <li>
          <span className="ww-sample-buttons">
            <button className="ww-button" onClick={() => void playSample(BRIAN_SAMPLE.file, BRIAN_SAMPLE.text, "Ardi")}>Ardi</button>
            <button className="ww-button ww-primary" onClick={() => void playSample(BRIAN_SAMPLE.file.replace("/audio/werewolf/", "/audio/werewolf/samples/brian/"), BRIAN_SAMPLE.text, "Brian")}>Brian</button>
          </span>
          <span><code>Contoh Brian (en-US-BrianMultilingualNeural), kalimat banyak bahasa Indonesia</code>{BRIAN_SAMPLE.text}</span>
        </li>
        <li>
          <span className="ww-sample-buttons">
            <button className="ww-button ww-primary" onClick={() => void playSample("/audio/werewolf/samples/brian/classic/dawn_single_kill_named.mp3", BRIAN_NAMED_TEXT, "Brian, dengan nama")}>Brian</button>
          </span>
          <span><code>Contoh Brian dengan nama pemain (pengumuman korban)</code>{BRIAN_NAMED_TEXT}</span>
        </li>
        <li>
          <span className="ww-sample-buttons">
            <button className="ww-button ww-primary" onClick={() => void playSample("/audio/werewolf/samples/elevenlabs-adam/classic/win_werewolf.mp3", "Desa telah dikuasai kegelapan... Para Werewolf menang!", "ElevenLabs emosi")}>ElevenLabs</button>
          </span>
          <span><code>Uji emosi ElevenLabs (eleven_v4, suara Adam): [evil laugh] … [laughs]</code>Desa telah dikuasai kegelapan... Para Werewolf menang!</span>
        </li></ul>
      </details>

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
