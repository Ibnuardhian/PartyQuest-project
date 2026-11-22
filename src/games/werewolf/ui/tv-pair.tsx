"use client";

import "./werewolf.css";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { WEREWOLF_TV_PATH } from "@/games/werewolf/paths";

/** TV / laptop pairing: room code + the 6-digit code the host shows in the lobby. */
export default function WerewolfTvPair() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomCode}/tv/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairingCode }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "TV belum dapat dihubungkan.");
      router.push(`${WEREWOLF_TV_PATH}/${roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "TV belum dapat dihubungkan.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell werewolf-theme">
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Layar TV</span></SiteHeader>
    <section className="ww-game">
      <form className="ww-panel" onSubmit={(event) => void submit(event)}>
        <span className="section-kicker">LAYAR BERSAMA · OPSIONAL</span>
        <h2>Hubungkan TV</h2>
        <p className="ww-muted">Host membuat kode TV di lobi. Setelah terhubung, suara moderator diputar di TV dan HP host diam.</p>
        <label className="ww-label" htmlFor="tv-room">Kode room</label>
        <input id="tv-room" className="ww-input ww-code" maxLength={6} value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" />
        <label className="ww-label" htmlFor="tv-pair">Kode TV (6 angka)</label>
        <input id="tv-pair" className="ww-input ww-code" inputMode="numeric" maxLength={6} value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" />
        <button className="ww-button ww-primary" disabled={busy || roomCode.length !== 6 || pairingCode.length !== 6}>Hubungkan</button>
        {error && <p className="ww-alert" role="alert">{error}</p>}
      </form>
    </section>
    <SiteFooter left="WEREWOLF · TV" right="Layar baca-saja: tidak menampilkan role" />
  </main>;
}
