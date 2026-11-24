"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "@/components/site/qr-code";
import { ConnectionNote, SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { getGameModule } from "@/games/registry";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";
import { useRoomEvents, type RoomEventStatus } from "@/lib/realtime/use-room-events";

interface Member { user_id: string; display_name: string; seat_no: number; is_ready: boolean; is_alive: boolean; online: boolean; }
interface RoomData {
  room: { id: string; code: string; gameKey: string; status: "lobby" | "in_progress" | "finished" | "abandoned"; settings: unknown; expiresAt: string; maxPlayers: number };
  members: Member[];
  session: { id: string; round_no: number; status: string; state_version: number; phase: string } | null;
  currentUserId: string;
  hostUserId: string;
  isHost: boolean;
  tvConnected: boolean;
}

/** Platform lobby shared by every Online Room game. Game-specific labels come from the game module. */
export default function RoomLobby({ code }: { code: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Menghubungkan…");
  const [tvCode, setTvCode] = useState<{ code: string; minutes: number } | null>(null);
  const [gameKey, setGameKey] = useState<string | null>(null);

  const load = useCallback(async (redirect = true) => {
    try {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const payload = await response.json() as { data?: RoomData; error?: { message?: string; code?: string; gameKey?: string } };
      if (!response.ok || !payload.data) {
        setRoom(null);
        // The game key is public (anyone with the code can join), so the join form can wear the game's theme.
        if (payload.error?.gameKey) setGameKey(payload.error.gameKey);
        if (payload.error?.code === "not_a_member") setError("");
        else setError(payload.error?.message ?? "Room belum dapat dimuat.");
        setConnection("Belum terhubung");
        return;
      }
      setRoom(payload.data);
      setGameKey(payload.data.room.gameKey);
      setError("");
      if (redirect && payload.data.session?.status === "in_progress") router.replace(`/room/${code}/play?session=${payload.data.session.id}`);
    } catch {
      setConnection("Menyambungkan ulang…");
    }
  }, [code, router]);

  useEffect(() => {
    void ensureBrowserGuest().then(() => load()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Sesi tamu belum siap."));
    // Slow fallback for networks that block streaming responses.
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const onEventStatus = useCallback((status: RoomEventStatus) => setConnection(status === "live" ? "Terhubung" : status === "connecting" ? "Menghubungkan…" : "Menyambungkan ulang…"), []);
  const refresh = useCallback(() => void load(), [load]);
  useRoomEvents(room ? code : null, refresh, onEventStatus);

  async function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await ensureBrowserGuest();
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

  async function saveSettings(settings: unknown) {
    setError("");
    const response = await fetch(`/api/rooms/${code}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "Pengaturan belum tersimpan.");
      return;
    }
    await load(false);
  }

  async function createTvCode() {
    setError("");
    const response = await fetch(`/api/rooms/${code}/tv/pairing`, { method: "POST" });
    const payload = await response.json() as { data?: { code: string; minutes: number }; error?: { message?: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Kode TV belum dapat dibuat."); return; }
    setTvCode(payload.data);
  }

  async function shareRoom() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`); setError("Tautan room disalin."); }
    catch { setError(`Bagikan kode room: ${code}`); }
  }

  const game = gameKey ? getGameModule(gameKey) : null;
  const me = room?.members.find((member) => member.user_id === room.currentUserId);

  // The lobby wears the game's own theme so it matches its catalog card and in-game screens.
  return <main className={`page-shell${game?.themeClass ? ` ${game.themeClass}` : ""}`}><SiteHeader><ConnectionNote label={connection} /></SiteHeader>
    <section className="lobby-wrap">
      <div className="lobby-heading"><span className="section-kicker">ONLINE ROOM{game ? ` · ${game.title.toUpperCase()}` : ""}</span><h1>Room <em>{code}</em></h1><p className="hero-description">Bagikan kode ini ke temanmu. Siapkan semua pemain sebelum host memulai.</p></div>
      {!room ? <section className="setup-card lobby-card">{error && <p className="error-message" role="alert">{error}</p>}<h2>Gabung ke room</h2><form className="action-form" onSubmit={joinRoom}><label className="field-label" htmlFor="lobby-name">Nama tampilan</label><input id="lobby-name" maxLength={24} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama yang dilihat teman" /><button className="primary-button" disabled={busy || !displayName.trim()}>Gabung <span>→</span></button></form></section>
        : <div className="lobby-grid"><section className="setup-card lobby-card"><div className="lobby-card-head"><div><span className="section-kicker">KODE ROOM</span><strong className="room-code">{room.room.code}</strong></div><button className="secondary-button" onClick={shareRoom}>Salin tautan</button></div>{room.room.status === "lobby" && <QrCode path={`/room/${room.room.code}`} label="Pindai untuk bergabung" />}<p className="status-note">{room.room.status === "finished" ? "Ronde selesai" : room.room.status === "in_progress" ? "Permainan berjalan" : "Menunggu pemain"} · {room.members.length}/{room.room.maxPlayers} pemain</p><div className="member-list">{room.members.map((member) => <div className="member-row" key={member.user_id}><span className="avatar-dot">{member.display_name.slice(0, 1).toUpperCase()}</span><span className={member.online ? "presence-dot online" : "presence-dot"} role="img" aria-label={member.online ? "Online" : "Offline"} title={member.online ? "Online" : "Offline"} /><span className="member-name">{member.display_name}{member.user_id === room.currentUserId && <small> (kamu)</small>}{member.user_id === room.hostUserId && <small> · host</small>}</span>{member.user_id === room.currentUserId ? <span className={member.is_ready ? "ready-tag ready" : "ready-tag"}>{member.is_ready ? "Siap" : "Belum siap"}</span> : <span className="ready-tag">{member.is_ready ? "Siap" : "Menunggu"}</span>}</div>)}</div>
          <div className="lobby-actions">{room.room.status === "lobby" && <button className="primary-button" disabled={busy} onClick={() => void roomAction("ready", { ready: !me?.is_ready })}>{me?.is_ready ? "Batalkan status siap" : "Saya siap"}<span>✓</span></button>}{room.isHost && room.room.status === "lobby" && <button className="secondary-wide" disabled={busy || room.members.length < 3 || room.members.some((member) => !member.is_ready)} onClick={() => void roomAction("start")}>Mulai permainan →</button>}{room.isHost && room.room.status === "finished" && <button className="primary-button" disabled={busy || room.members.length < 3} onClick={() => void roomAction("rematch")}>Main ulang <span>↻</span></button>}{room.isHost && game?.tvSetupHref && <div className="tv-pairing">
            {room.tvConnected ? <p className="status-note">Layar TV terhubung ✓ · suara moderator diputar di TV</p> : <button className="secondary-wide" disabled={busy} onClick={() => void createTvCode()}>Hubungkan layar TV (opsional)</button>}
            {tvCode && !room.tvConnected && <p className="status-note">Buka <strong>{typeof window === "undefined" ? game.tvSetupHref : `${window.location.origin}${game.tvSetupHref}`}</strong> di TV, masukkan kode room <strong>{room.room.code}</strong> dan kode TV <strong className="tv-code">{tvCode.code}</strong> (berlaku {tvCode.minutes} menit).</p>}
          </div>}<button className="text-button" disabled={busy} onClick={() => void roomAction("leave")}>Keluar dari room</button></div>{error && <p className="error-message" role="alert">{error}</p>}</section>
          <aside className="setup-card rules-card"><span className="section-kicker">PENGATURAN RONDE</span>{room.isHost && room.room.status === "lobby" && game?.RoomSettingsEditor
            ? <game.RoomSettingsEditor settings={room.room.settings} playerCount={room.members.length} disabled={busy} onSave={saveSettings} />
            : (game?.describeRoomSettings?.(room.room.settings) ?? []).map((item) => <p key={item.label}>{item.label} <strong>{item.value}</strong></p>)}<div className="privacy-note left-note">Setiap pemain menerima informasi rahasia sendiri. Jangan bagikan layar saat kartu dibuka.</div></aside></div>}
    </section><SiteFooter left="LOBI" right={room ? `Koneksi: ${connection}` : "Sesi guest tersimpan di browser ini"} /></main>;
}
