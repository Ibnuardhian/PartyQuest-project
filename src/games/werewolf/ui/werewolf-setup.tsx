"use client";

import "./werewolf.css";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { CLASSIC_ROLES } from "@/games/werewolf/contract";
import { WEREWOLF_ONUW_PATH, WEREWOLF_VOICE_PILOT_PATH } from "@/games/werewolf/paths";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";

/** Werewolf setup: create or join a Classic room. Composition and timers are set by the host in the lobby. */
export default function WerewolfSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void ensureBrowserGuest().then(() => { if (!cancelled) setReady(true); }).catch((cause: unknown) => { if (!cancelled) setMessage(cause instanceof Error ? cause.message : "Sesi tamu belum siap."); });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent, mode: "create" | "join") {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await ensureBrowserGuest();
      const response = await fetch(mode === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { gameKey: "werewolf", displayName: name } : { displayName: name, code }),
      });
      const payload = await response.json() as { data?: { code?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.code) throw new Error(payload.error?.message ?? "Room belum dapat diproses.");
      router.push(`/room/${payload.data.code}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Room belum dapat diproses.");
    } finally {
      setWorking(false);
    }
  }

  return <main className="page-shell werewolf-theme">
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Werewolf · Online Room</span></SiteHeader>
    <section className="ww-setup">
      <div className="ww-setup-copy">
        <Link className="text-button" href="/">← Kembali ke katalog</Link>
        <span className="section-kicker">GAME · WEREWOLF</span>
        <h1>Desa ini <em>menyimpan rahasia.</em></h1>
        <p className="ww-setup-lead">Tidak ada yang perlu jadi moderator. Narator suara memandu malam, setiap pemain beraksi dari HP masing-masing, dan layar malam yang gelap serta mini-game ketuk membuat tidak ada yang bisa menebak role dari gerak-gerik.</p>
        <ul className="ww-facts"><li>5–16 pemain</li><li>Satu HP per pemain</li><li>Narator suara di HP host atau TV</li></ul>
        <details className="ww-roster"><summary>Daftar role ({CLASSIC_ROLES.length})</summary><ul>{CLASSIC_ROLES.map((role) => <li key={role}><strong>{CLASSIC_ROLE_INFO[role].name}</strong>{CLASSIC_ROLE_INFO[role].twist ? " · twist" : ""}<small>{CLASSIC_ROLE_INFO[role].description}</small></li>)}</ul></details>
        <Link className="ww-pill-link" href={WEREWOLF_VOICE_PILOT_PATH}><SpeakerIcon /> Coba suara moderator <span aria-hidden="true">→</span></Link>
      </div>

      <section className="ww-setup-card" aria-labelledby="ww-setup-title">
        <div className="ww-setup-block">
          <div className="ww-setup-heading">
            <span className="section-kicker">MODE 1 · HYBRID CLASSIC</span>
            <h2 id="ww-setup-title">Buat atau gabung</h2>
          </div>
          <div className="ww-field">
            <label className="ww-field-label" htmlFor="ww-name">Nama tampilan</label>
            <input id="ww-name" className="ww-field-input" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama yang dilihat teman" />
          </div>
          <form className="ww-field" onSubmit={(event) => void submit(event, "create")}>
            <button className="ww-btn ww-btn-primary" disabled={!ready || working || !name.trim()}>Buat room baru</button>
            <p className="ww-field-hint">Host mengatur komposisi role, mode pemain tereliminasi, dan durasi di lobi.</p>
          </form>
          <form className="ww-field" onSubmit={(event) => void submit(event, "join")}>
            <label className="ww-field-label" htmlFor="ww-code">Kode room</label>
            <div className="ww-join-row">
              <input id="ww-code" className="ww-field-input ww-field-code" maxLength={6} autoCapitalize="characters" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" />
              <button className={`ww-btn ww-btn-secondary${code.length === 6 ? " is-ready" : ""}`} disabled={!ready || working || code.length !== 6 || !name.trim()}>Gabung</button>
            </div>
          </form>
          {!ready && !message && <p className="ww-field-hint">Menghubungkan sesi tamu…</p>}
          {message && <p className="ww-alert" role="alert">{message}</p>}
        </div>
        <hr className="ww-setup-divider" />
        <div className="ww-setup-block">
          <div className="ww-setup-heading">
            <span className="section-kicker">MODE 2 · ONUW (1 HP + KARTU FISIK)</span>
            <p className="ww-field-hint">Satu HP di tengah meja memvalidasi kartu dan memandu malam dengan suara.</p>
          </div>
          <Link className="ww-btn ww-btn-secondary" href={WEREWOLF_ONUW_PATH}><PhoneIcon /> Main ONUW</Link>
        </div>
      </section>
    </section>
    <SiteFooter left="WEREWOLF" right="Game kedua di katalog PartyQuest" />
  </main>;
}

function SpeakerIcon() {
  return <svg className="ww-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>;
}

function PhoneIcon() {
  return <svg className="ww-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>;
}
