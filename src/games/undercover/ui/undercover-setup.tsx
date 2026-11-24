"use client";

import "./undercover.css";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import type { Category } from "@/games/undercover/contract";
import { undercoverGame } from "@/games/undercover/engine";
import { createLocalGameSession, LOCAL_GAME_PATH, writeLocalGameSession } from "@/games/undercover/local-session";
import { UNDERCOVER_ONLINE_SETUP_PATH, UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";
import { CATEGORY_LABELS } from "@/games/undercover/ui/labels";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";

type SetupMode = "local" | "online";

/** Undercover setup: Pass-and-Play form or Online Room create/join, on the same dossier card. */
export default function UndercoverSetup() {
  const router = useRouter();
  const [setupMode, setSetupMode] = useState<SetupMode>("local");
  const [namesInput, setNamesInput] = useState("Alya\nBima\nCitra");
  const [category, setCategory] = useState<Category>("campuran");
  const [undercoverCount, setUndercoverCount] = useState(1);
  const [mrWhiteEnabled, setMrWhiteEnabled] = useState(false);
  const [error, setError] = useState("");
  const [onlineName, setOnlineName] = useState("");
  const [onlineRoomCode, setOnlineRoomCode] = useState("");
  const [onlineReady, setOnlineReady] = useState(false);
  const [onlineWorking, setOnlineWorking] = useState(false);
  const [onlineMessage, setOnlineMessage] = useState("");

  useEffect(() => {
    const syncMode = () => setSetupMode(new URLSearchParams(window.location.search).get("mode") === "online" ? "online" : "local");
    const initial = window.setTimeout(syncMode, 0);
    window.addEventListener("popstate", syncMode);
    return () => { window.clearTimeout(initial); window.removeEventListener("popstate", syncMode); };
  }, []);

  useEffect(() => {
    if (setupMode !== "online") return;
    let cancelled = false;
    void ensureBrowserGuest().then(() => {
      if (!cancelled) setOnlineReady(true);
    }).catch((cause: unknown) => {
      if (!cancelled) setOnlineMessage(cause instanceof Error ? cause.message : "Koneksi Online Room belum siap.");
    });
    return () => { cancelled = true; };
  }, [setupMode]);

  const playerCount = useMemo(() => namesInput.split(/\r?\n/).map((name) => name.trim()).filter(Boolean).length, [namesInput]);

  async function startLocalGame() {
    setError("");
    try {
      const names = namesInput.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
      const session = await createLocalGameSession(undercoverGame.createInitialState(names, { category, undercoverCount, mrWhiteEnabled }));
      if (!writeLocalGameSession(session)) {
        setError("Browser tidak dapat menyimpan progres; Pass-and-Play memerlukan penyimpanan sesi tab.");
        return;
      }
      router.push(`${LOCAL_GAME_PATH}#${session.hash}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permainan belum dapat dimulai.");
    }
  }

  function changeSetupMode(mode: SetupMode) {
    if (mode === "online" && setupMode !== "online") setOnlineReady(false);
    setSetupMode(mode);
    setError("");
    setOnlineMessage("");
    router.replace(mode === "online" ? UNDERCOVER_ONLINE_SETUP_PATH : UNDERCOVER_SETUP_PATH);
  }

  async function submitOnlineRoom(event: FormEvent<HTMLFormElement>, mode: "create" | "join") {
    event.preventDefault();
    setOnlineMessage("");
    setOnlineWorking(true);
    try {
      await ensureBrowserGuest();
      const response = await fetch(mode === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create"
          ? { gameKey: "undercover", displayName: onlineName, settings: { category, undercoverCount, mrWhiteEnabled } }
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

  const mrWhiteToggle = <label className="toggle-row"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata—bisa menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>;

  return <main className="page-shell undercover-theme">
    <SiteHeader><div className="topbar-actions"><span className="topbar-note"><span className="live-dot" /> Kumpulan game untuk dimainkan bersama</span>{setupMode === "local" && <button type="button" className="online-link" onClick={() => changeSetupMode("online")}>Online Room ↗</button>}</div></SiteHeader>
    <section className="hero-grid" id="beranda">
      <div className="hero-copy">
        <Link className="text-button catalog-back" href="/">← Kembali ke katalog</Link>
        <div className="eyebrow"><span>✦</span> GAME · UNDERCOVER</div>
        <h1>Seberapa jago<br />kamu <em>menyamar?</em></h1>
        <p className="hero-description">Semua punya kata rahasia—kecuali si penyamar. Beri petunjuk secara lisan, baca situasi, dan temukan siapa yang berbeda.</p>
        <div className="hero-facts"><span>👥 3–12 pemain</span><span>◷ 15–30 menit</span><span>▣ {setupMode === "local" ? "Satu perangkat" : "Perangkat masing-masing"}</span></div>
        <div className="round-preview" aria-label="Ringkasan cara bermain">
          <div className="round-line" />
          {[["01", "Lihat kata", "Rahasiakan isi kartu"], ["02", "Beri petunjuk", "Jangan terlalu jelas"], ["03", "Cari penyamar", "Diskusi lalu voting"]].map(([number, title, description]) => <div className="round-step" key={number}><span className="step-number">{number}</span><strong>{title}</strong><small>{description}</small></div>)}
        </div>
      </div>

      <section className="setup-card" aria-labelledby="setup-title">
        <div className="card-heading"><div><span className="section-kicker">{setupMode === "local" ? "MODE LOKAL" : "MODE ONLINE"}</span><h2 id="setup-title">{setupMode === "local" ? "Siapkan permainan" : "Buat atau gabung"}</h2></div><span className="card-icon">{setupMode === "local" ? "♧" : "⌁"}</span></div>
        <div className="setup-mode-switch" role="group" aria-label="Pilih mode permainan"><button type="button" className={setupMode === "local" ? "mode-option active" : "mode-option"} aria-pressed={setupMode === "local"} onClick={() => changeSetupMode("local")}>Pass-and-Play</button><button type="button" className={setupMode === "online" ? "mode-option active" : "mode-option"} aria-pressed={setupMode === "online"} onClick={() => changeSetupMode("online")}>Online Room</button></div>
        {setupMode === "local" ? <>
          <label className="field-label" htmlFor="player-names">Nama pemain <span>· satu nama per baris</span></label>
          <textarea id="player-names" className="names-input" value={namesInput} onChange={(event) => setNamesInput(event.target.value)} rows={5} maxLength={360} placeholder={"Alya\nBima\nCitra"} />
          <div className="input-caption"><span>Minimal 3, maksimal 12 pemain</span><span className={playerCount >= 3 && playerCount <= 12 ? "count-ok" : "count-warning"}>{playerCount}/12</span></div>
          <div className="form-row">
            <div className="form-field"><label className="field-label" htmlFor="category">Kategori kata</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="form-field"><label className="field-label" htmlFor="undercover-count">Undercover</label><select id="undercover-count" value={undercoverCount} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{Array.from({ length: Math.min(4, Math.max(1, playerCount - Number(mrWhiteEnabled) - 2)) }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div>
          </div>
          {mrWhiteToggle}
          <button className="primary-button" onClick={() => void startLocalGame()}>Mulai permainan <span aria-hidden="true">→</span></button>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="privacy-note"><span aria-hidden="true">◉</span> Kata akan dibuka bergiliran di perangkat ini. Pastikan pemain lain tidak mengintip.</p>
        </> : <div className="uc-online-stack">
          <div className="uc-field"><label className="field-label" htmlFor="online-player-name">Nama tampilan</label><input className="text-input online-text-input" id="online-player-name" maxLength={24} value={onlineName} onChange={(event) => setOnlineName(event.target.value)} placeholder="Nama yang dilihat teman" /></div>
          <form className="uc-online-stack" onSubmit={(event) => void submitOnlineRoom(event, "create")}><h3 className="subheading">Buat room baru</h3><div className="form-row"><div className="form-field"><label className="field-label" htmlFor="online-category">Kategori</label><select id="online-category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="form-field"><label className="field-label" htmlFor="online-undercover-count">Undercover</label><select id="online-undercover-count" value={undercoverCount} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{[1, 2, 3].map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div></div>{mrWhiteToggle}<button className="primary-button" disabled={!onlineReady || onlineWorking || !onlineName.trim()}>Buat room <span>→</span></button></form>
          <div className="divider-label"><span />ATAU<span /></div>
          <form className="uc-field" onSubmit={(event) => void submitOnlineRoom(event, "join")}><label className="field-label" htmlFor="online-join-code">Kode room</label><div className="join-row"><input className="text-input online-text-input code-input" id="online-join-code" maxLength={6} autoCapitalize="characters" autoComplete="off" value={onlineRoomCode} onChange={(event) => setOnlineRoomCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" /><button className={`secondary-button${onlineRoomCode.length === 6 ? " is-ready" : ""}`} disabled={!onlineReady || onlineWorking || onlineRoomCode.length !== 6 || !onlineName.trim()}>Gabung</button></div></form>
          {!onlineReady && !onlineMessage && <p className="status-note">Menghubungkan sesi tamu…</p>}{onlineMessage && <p className="error-message" role="alert">{onlineMessage}</p>}
          <p className="privacy-note">Sesi tamu tidak memakai email atau kata sandi.</p>
        </div>}
      </section>
    </section>
    <SiteFooter left="UNDERCOVER" right="Undercover · game pertama di katalog" />
  </main>;
}
