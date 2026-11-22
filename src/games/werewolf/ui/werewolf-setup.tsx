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
        <p className="ww-muted">Tidak ada yang perlu jadi moderator. Narator suara memandu malam, setiap pemain beraksi dari HP masing-masing, dan layar malam yang gelap serta mini-game ketuk membuat tidak ada yang bisa menebak role dari gerak-gerik.</p>
        <ul className="ww-facts"><li>5–16 pemain</li><li>Satu HP per pemain</li><li>Suara Microsoft Edge Neural di HP host</li></ul>
        <details className="ww-roster"><summary>Daftar role ({CLASSIC_ROLES.length})</summary><ul>{CLASSIC_ROLES.map((role) => <li key={role}><strong>{CLASSIC_ROLE_INFO[role].name}</strong>{CLASSIC_ROLE_INFO[role].twist ? " · twist" : ""}<small>{CLASSIC_ROLE_INFO[role].description}</small></li>)}</ul></details>
        <Link className="text-button" href={WEREWOLF_VOICE_PILOT_PATH}>Coba suara moderator →</Link>
      </div>

      <section className="ww-panel" aria-labelledby="ww-setup-title">
        <span className="section-kicker">MODE 1 · HYBRID CLASSIC</span>
        <h2 id="ww-setup-title">Buat atau gabung</h2>
        <label className="ww-label" htmlFor="ww-name">Nama tampilan</label>
        <input id="ww-name" className="ww-input" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama yang dilihat teman" />
        <form onSubmit={(event) => void submit(event, "create")}>
          <button className="ww-button ww-primary ww-wide" disabled={!ready || working || !name.trim()}>Buat room baru</button>
        </form>
        <p className="ww-muted">Host mengatur komposisi role, mode pemain tereliminasi, dan durasi di lobi.</p>
        <form className="ww-join" onSubmit={(event) => void submit(event, "join")}>
          <label className="ww-label" htmlFor="ww-code">Kode room</label>
          <div className="ww-join-row"><input id="ww-code" className="ww-input ww-code" maxLength={6} autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" /><button className="ww-button" disabled={!ready || working || code.length !== 6 || !name.trim()}>Gabung</button></div>
        </form>
        {!ready && !message && <p className="ww-muted">Menghubungkan sesi tamu…</p>}
        {message && <p className="ww-alert" role="alert">{message}</p>}
        <div className="ww-soon"><span className="section-kicker">MODE 2 · ONUW (1 HP + KARTU FISIK)</span><p className="ww-muted">Satu HP di tengah meja memvalidasi kartu dan memandu malam dengan suara.</p><Link className="ww-button ww-wide" href={WEREWOLF_ONUW_PATH}>Main ONUW</Link></div>
      </section>
    </section>
    <SiteFooter left="WEREWOLF" right="Game kedua di katalog PartyQuest" />
  </main>;
}
