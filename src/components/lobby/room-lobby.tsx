"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureBrowserGuest, saveGuestProfile } from "@/lib/auth/browser-guest";
import { createClient } from "@/lib/supabase/client";

interface Member { user_id: string; display_name: string; seat_no: number; is_ready: boolean; is_alive: boolean; }
interface RoomData {
  room: { id: string; code: string; status: "lobby" | "in_progress" | "finished" | "abandoned"; settings: { category: string; undercoverCount: number; mrWhiteEnabled: boolean }; expiresAt: string; maxPlayers: number };
  members: Member[];
  session: { id: string; round_no: number; status: string; state_version: number; phase: string } | null;
  currentUserId: string;
  hostUserId: string;
  isHost: boolean;
}

export default function RoomLobby({ code }: { code: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Menghubungkan…");

  const load = useCallback(async (redirect = true) => {
    try {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const payload = await response.json() as { data?: RoomData; error?: { message?: string; code?: string } };
      if (!response.ok || !payload.data) {
        setRoom(null);
        if (payload.error?.code === "not_a_member") setError("");
        else setError(payload.error?.message ?? "Room belum dapat dimuat.");
        setConnection("Belum terhubung");
        return;
      }
      setRoom(payload.data);
      setError("");
      setConnection("Terhubung");
      if (redirect && payload.data.session?.status === "in_progress") router.replace(`/room/${code}/play?session=${payload.data.session.id}`);
    } catch {
      setConnection("Menyambungkan ulang…");
    }
  }, [code, router]);

  useEffect(() => {
    void ensureBrowserGuest().then(() => load()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Sesi tamu belum siap."));
    const interval = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!room?.room.id) return;
    let supabaseClient: ReturnType<typeof createClient>;
    try { supabaseClient = createClient(); } catch { return; }
    const channel = supabaseClient.channel(`room:${room.room.id}`, { config: { private: true } })
      .on("broadcast", { event: "state_changed" }, () => void load())
      .subscribe((status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => setConnection(status === "SUBSCRIBED" ? "Terhubung" : "Menyambungkan ulang…"));
    return () => { void supabaseClient.removeChannel(channel); };
  }, [room?.room.id, load]);

  async function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await ensureBrowserGuest();
      await saveGuestProfile(displayName);
      const response = await fetch("/api/rooms/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, displayName }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Belum dapat bergabung ke room.");
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Belum dapat bergabung ke room.");
    } finally { setBusy(false); }
  }

  async function roomAction(path: string, body?: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/rooms/${code}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const payload = await response.json() as { error?: { message?: string }; data?: { sessionId?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Aksi belum berhasil.");
      if (payload.data?.sessionId) { router.push(`/room/${code}/play?session=${payload.data.sessionId}`); return; }
      if (path === "leave") { router.push("/"); return; }
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi belum berhasil.");
      await load(false);
    } finally { setBusy(false); }
  }

  async function shareRoom() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`); setError("Tautan room disalin."); }
    catch { setError(`Bagikan kode room: ${code}`); }
  }

  return <main className="page-shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">P</span>partyquest</Link><span className="topbar-note"><span className="live-dot" />{connection}</span></header>
    <section className="lobby-wrap">
      <div className="lobby-heading"><span className="section-kicker">ONLINE ROOM · UNDERCOVER</span><h1>Room <em>{code}</em></h1><p className="hero-description">Bagikan kode ini ke temanmu. Siapkan semua pemain sebelum host memulai.</p></div>
      {!room ? <section className="setup-card lobby-card">{error && <p className="error-message" role="alert">{error}</p>}<h2>Gabung ke room</h2><form className="action-form" onSubmit={joinRoom}><label className="field-label" htmlFor="lobby-name">Nama tampilan</label><input id="lobby-name" maxLength={24} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama yang dilihat teman" /><button className="primary-button" disabled={busy || !displayName.trim()}>Gabung <span>→</span></button></form></section>
        : <div className="lobby-grid"><section className="setup-card lobby-card"><div className="lobby-card-head"><div><span className="section-kicker">KODE ROOM</span><strong className="room-code">{room.room.code}</strong></div><button className="secondary-button" onClick={shareRoom}>Salin tautan</button></div><p className="status-note">{room.room.status === "finished" ? "Ronde selesai" : room.room.status === "in_progress" ? "Permainan berjalan" : "Menunggu pemain"} · {room.members.length}/{room.room.maxPlayers} pemain</p><div className="member-list">{room.members.map((member) => <div className="member-row" key={member.user_id}><span className="avatar-dot">{member.display_name.slice(0, 1).toUpperCase()}</span><span className="member-name">{member.display_name}{member.user_id === room.currentUserId && <small> (kamu)</small>}{member.user_id === room.hostUserId && <small> · host</small>}</span>{member.user_id === room.currentUserId ? <span className={member.is_ready ? "ready-tag ready" : "ready-tag"}>{member.is_ready ? "Siap" : "Belum siap"}</span> : <span className="ready-tag">{member.is_ready ? "Siap" : "Menunggu"}</span>}</div>)}</div>
          <div className="lobby-actions">{room.room.status === "lobby" && <button className="primary-button" disabled={busy} onClick={() => void roomAction("ready", { ready: !room.members.find((member) => member.user_id === room.currentUserId)?.is_ready })}>{room.members.find((member) => member.user_id === room.currentUserId)?.is_ready ? "Batalkan status siap" : "Saya siap"}<span>✓</span></button>}{room.isHost && room.room.status === "lobby" && <button className="secondary-wide" disabled={busy || room.members.length < 3 || room.members.some((member) => !member.is_ready)} onClick={() => void roomAction("start")}>Mulai permainan →</button>}{room.isHost && room.room.status === "finished" && <button className="primary-button" disabled={busy || room.members.length < 3} onClick={() => void roomAction("rematch")}>Main ulang <span>↻</span></button>}<button className="text-button" disabled={busy} onClick={() => void roomAction("leave")}>Keluar dari room</button></div>{error && <p className="error-message" role="alert">{error}</p>}</section>
          <aside className="setup-card rules-card"><span className="section-kicker">PENGATURAN RONDE</span><p>Kategori <strong>{room.room.settings.category}</strong></p><p>Undercover <strong>{room.room.settings.undercoverCount}</strong></p><p>Mr. White <strong>{room.room.settings.mrWhiteEnabled ? "Aktif" : "Nonaktif"}</strong></p><div className="privacy-note left-note">Setiap pemain menerima kata rahasia sendiri. Jangan bagikan layar saat kartu dibuka.</div></aside></div>}
    </section><footer className="footer"><span>PARTYQUEST <span className="footer-star">✦</span> LOBI</span><span>{room ? `Koneksi: ${connection}` : "Sesi guest tersimpan di browser ini"}</span></footer></main>;
}
