"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogLink } from "@/components/site/catalog-link";
import { QrCode } from "@/components/site/qr-code";
import { ConnectionNote, SiteHeader } from "@/components/site/site-chrome";
import { getGameModule } from "@/games/registry";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";
import { useRoomEvents, type RoomEventStatus } from "@/lib/realtime/use-room-events";

interface Member { user_id: string; display_name: string; seat_no: number; is_ready: boolean; is_alive: boolean; online: boolean; }
interface RoomPreview { code: string; hostName: string; playerCount: number; maxPlayers: number; status: string; settings: unknown }
interface RoomData {
  room: { id: string; code: string; gameKey: string; status: "lobby" | "in_progress" | "finished" | "abandoned"; settings: unknown; expiresAt: string; maxPlayers: number };
  members: Member[];
  scores: Record<string, number> | null;
  session: { id: string; round_no: number; status: string; state_version: number; phase: string } | null;
  currentUserId: string;
  hostUserId: string;
  isHost: boolean;
  tvConnected: boolean;
}

/** Platform lobby shared by every Online Room game. Game-specific labels come from the game module. */
export default function RoomLobby({ code, initialGameKey = null }: { code: string; initialGameKey?: string | null }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Menghubungkan…");
  const [tvCode, setTvCode] = useState<{ code: string; minutes: number } | null>(null);
  const [gameKey, setGameKey] = useState<string | null>(initialGameKey);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [hostNotice, setHostNotice] = useState(false);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [roomGone, setRoomGone] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const guardOn = useRef(true);
  const wasHost = useRef<boolean | null>(null);
  const isMember = Boolean(room);

  const load = useCallback(async (redirect = true) => {
    try {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const payload = await response.json() as { data?: RoomData; error?: { message?: string; code?: string; gameKey?: string; preview?: RoomPreview } };
      if (!response.ok || !payload.data) {
        setRoom(null);
        // The game key is public (anyone with the code can join), so the join form can wear the game's theme.
        if (payload.error?.gameKey) setGameKey(payload.error.gameKey);
        setPreview(payload.error?.preview ?? null);
        setRoomGone(payload.error?.code === "room_not_found" || payload.error?.code === "room_expired" || payload.error?.preview?.status === "abandoned");
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

  async function copyText(kind: "code" | "link", text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(kind); window.setTimeout(() => setCopied(null), 1800); }
    catch { setError(`Salin manual: ${text}`); }
  }

  async function confirmLeave() {
    guardOn.current = false;
    setLeaveOpen(false);
    await roomAction("leave");
    guardOn.current = true;
  }

  // The host role moves when the host leaves; tell the player who just received it.
  const isHostNow = room?.isHost;
  useEffect(() => {
    if (isHostNow === undefined) { wasHost.current = null; return; }
    if (wasHost.current === false && isHostNow) {
      const timer = window.setTimeout(() => setHostNotice(true), 0);
      wasHost.current = true;
      return () => window.clearTimeout(timer);
    }
    wasHost.current = isHostNow;
  }, [isHostNow]);

  // Back button / tab close inside an active room asks first instead of silently dropping the player.
  useEffect(() => {
    if (!isMember) return;
    if (!(window.history.state as { lobbyGuard?: boolean } | null)?.lobbyGuard) window.history.pushState({ lobbyGuard: true }, "", window.location.href);
    const onPop = () => {
      if (!guardOn.current) return;
      window.history.pushState({ lobbyGuard: true }, "", window.location.href);
      setLeaveOpen(true);
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!guardOn.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("beforeunload", onUnload); };
  }, [isMember]);

  const game = gameKey ? getGameModule(gameKey) : null;
  const showJoin = !room;
  useEffect(() => {
    // Desktop: ready to type straight away. Touch devices keep the keyboard closed until tapped.
    if (showJoin && nameInput.current && window.matchMedia("(pointer: fine)").matches) nameInput.current.focus();
  }, [showJoin, roomGone, preview?.code]);
  const me = room?.members.find((member) => member.user_id === room.currentUserId);
  const minPlayers = 3;
  const readyCount = room?.members.filter((member) => member.is_ready).length ?? 0;
  const status = room?.room.status;
  const startBlocker = !room ? "" : room.members.length < minPlayers ? `BUTUH MINIMAL ${minPlayers} PEMAIN (${room.members.length}/${minPlayers})` : readyCount < room.members.length ? `MENUNGGU SEMUA SIAP (${readyCount}/${room.members.length})` : "";
  const showInvite = status === "lobby" || status === "finished";
  const settingsItems = room ? (game?.describeRoomSettings?.(room.room.settings) ?? []) : [];
  const editable = Boolean(room?.isHost && status === "lobby" && game?.RoomSettingsEditor);

  const themeClass = game?.themeClass ? ` ${game.themeClass}` : "";
  if (!room) {
    const joinable = preview ? preview.status !== "in_progress" && preview.playerCount < preview.maxPlayers : true;
    const pill = !preview ? null : preview.status === "in_progress" ? { tone: "warn", text: "Sedang bermain" } : preview.playerCount >= preview.maxPlayers ? { tone: "full", text: "Room penuh" } : preview.status === "finished" ? { tone: "ok", text: "Ronde selesai · bisa bergabung" } : { tone: "ok", text: "Menunggu di lobi" };
    const modeLabel = preview ? game?.roomModeLabel?.(preview.settings) ?? null : null;
    return <main className={`page-shell${themeClass}`}><SiteHeader><ConnectionNote label={connection} /></SiteHeader>
      <section className="lj-page">
        <div className="lj-crumbs"><CatalogLink className="lj-back">← Kembali ke katalog</CatalogLink><span>ONLINE ROOM{game ? ` · ${game.title.toUpperCase()}` : ""}</span></div>
        <div className="lj-card">
          {roomGone ? <>
            <h1 className="lj-title">Room tidak ditemukan atau sudah berakhir</h1>
            <p className="lj-sub">Periksa kembali kodenya, atau minta host membuat room baru.</p>
            <CatalogLink className="lj-cta lj-cta-link">Kembali ke katalog</CatalogLink>
          </> : <>
            <h1 className="lj-title">Gabung Room <span className="lj-code">{code}</span></h1>
            {preview && pill && <div className="lj-meta">
              <div className="lj-meta-row"><span className={`lj-pill ${pill.tone}`}>● {pill.text}</span>{modeLabel && <span className="lj-mode">{modeLabel}</span>}</div>
              <div className="lj-meta-row"><span className="lj-host">👑 Host: <b>{preview.hostName || "—"}</b></span><span className="lj-count">👥 <b>{preview.playerCount}/{preview.maxPlayers}</b> pemain</span></div>
            </div>}
            {error && <p className="error-message" role="alert">{error}</p>}
            <form className="lj-form" onSubmit={joinRoom}>
              <label className="lj-label" htmlFor="lobby-name">Nama tampilan</label>
              <input id="lobby-name" ref={nameInput} className="lj-input" maxLength={24} autoComplete="nickname" value={displayName} disabled={!joinable} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama yang dilihat teman" />
              <button className="lj-cta" disabled={busy || !displayName.trim() || !joinable}>{joinable ? "Gabung →" : preview?.status === "in_progress" ? "Permainan sedang berjalan" : "Room penuh"}</button>
            </form>
          </>}
        </div>
      </section></main>;
  }

  // The lobby wears the game's own theme so it matches its catalog card and in-game screens.
  return <main className={`page-shell${game?.themeClass ? ` ${game.themeClass}` : ""}`}><SiteHeader><ConnectionNote label={connection} /></SiteHeader>
    <section className="lb-wrap">
      <div className="lb-bar"><span className="section-kicker">ONLINE ROOM{game ? ` · ${game.title.toUpperCase()}` : ""}</span>{room && <span className="lb-state">{status === "finished" ? "Ronde selesai" : status === "in_progress" ? "Permainan berjalan" : "Menunggu pemain"}</span>}</div>
      {!room ? null
        : <div className="lb-grid">
          <section className="setup-card lb-card lb-settings" aria-label="Pengaturan ronde">
            <div className="lb-card-head"><span className="section-kicker">{editable ? "PENGATURAN RONDE" : "ATURAN RONDE AKTIF"}</span>{!room.isHost && <span className="lb-badge">Diatur oleh Host</span>}</div>
            {editable && game?.RoomSettingsEditor
              ? <game.RoomSettingsEditor settings={room.room.settings} playerCount={room.members.length} disabled={busy} onSave={saveSettings} />
              : <div className="lb-stats">{settingsItems.map((item) => <div className="lb-stat" key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>}
            <p className="lb-note">Setiap pemain menerima informasi rahasia sendiri. Jangan bagikan layar saat kartu dibuka.</p>
          </section>
          <section className="setup-card lb-card lb-people" aria-label="Kode room dan daftar pemain">
            {showInvite ? <div className="lb-invite">
              <button type="button" className="lb-qr" onClick={() => setQrOpen(true)} aria-label="Perbesar kode QR"><QrCode path={`/room/${room.room.code}`} label="Pindai untuk bergabung" /></button>
              <div className="lb-invite-main"><span className="section-kicker">KODE ROOM</span><strong className="lb-code">{room.room.code}</strong>
                <div className="lb-invite-actions"><button type="button" className="secondary-button" onClick={() => void copyText("code", room.room.code)}>{copied === "code" ? "Tersalin ✓" : "Salin Kode"}</button><button type="button" className="secondary-button" onClick={() => void copyText("link", `${window.location.origin}/room/${room.room.code}`)}>{copied === "link" ? "Tersalin ✓" : "Salin Tautan"}</button></div></div>
            </div> : <div className="lb-invite-main"><span className="section-kicker">KODE ROOM</span><strong className="lb-code">{room.room.code}</strong></div>}
            <p className="lb-count"><span>Pemain</span><b>{room.members.length}/{room.room.maxPlayers}</b></p>
            <div className="lb-roster">{room.members.map((member) => <div className="lb-row" key={member.user_id}>
              <span className="lb-avatar">{member.display_name.slice(0, 1).toUpperCase()}<i className={member.online ? "lb-online on" : "lb-online"} role="img" aria-label={member.online ? "Online" : "Offline"} /></span>
              <span className="lb-name">{member.display_name}{member.user_id === room.currentUserId && <small className="lb-chip">Kamu</small>}{member.user_id === room.hostUserId && <small className="lb-chip host">♛ Host</small>}</span>
              {room.scores && <span className="lb-score" aria-label={`Skor ${room.scores[member.user_id] ?? 0}`}>🏆 {room.scores[member.user_id] ?? 0}</span>}
              <span className={member.is_ready ? "lb-pill ready" : "lb-pill"}>{member.is_ready ? "Siap ✓" : "Belum siap"}</span>
            </div>)}
            {room.members.length < minPlayers && Array.from({ length: Math.min(2, minPlayers - room.members.length) }, (_, index) => <div className="lb-row lb-empty" key={`empty-${index}`}>Menunggu pemain lain…</div>)}</div>
            <div className="lb-actions">
              {(status === "lobby" || status === "finished") && <button className={me?.is_ready ? "lb-btn lb-ready on" : "lb-btn lb-ready"} disabled={busy} onClick={() => void roomAction("ready", { ready: !me?.is_ready })}>{me?.is_ready ? "SUDAH SIAP ✓" : "TANDAI SIAP"}</button>}
              {room.isHost && status === "lobby" && <button className="lb-btn lb-start" disabled={busy || Boolean(startBlocker)} onClick={() => void roomAction("start")}>{startBlocker || "MULAI PERMAINAN →"}</button>}
              {room.isHost && status === "finished" && <button className="lb-btn lb-start" disabled={busy || room.members.length < minPlayers} onClick={() => void roomAction("rematch")}>{room.members.length < minPlayers ? `BUTUH MINIMAL ${minPlayers} PEMAIN (${room.members.length}/${minPlayers})` : "MAIN ULANG ↻"}</button>}
              {room.isHost && game?.tvSetupHref && <div className="tv-pairing">
                {room.tvConnected ? <p className="status-note">Layar TV terhubung ✓ · suara moderator diputar di TV</p> : <button className="secondary-wide" disabled={busy} onClick={() => void createTvCode()}>Hubungkan layar TV (opsional)</button>}
                {tvCode && !room.tvConnected && <p className="status-note">Buka <strong>{typeof window === "undefined" ? game.tvSetupHref : `${window.location.origin}${game.tvSetupHref}`}</strong> di TV, masukkan kode room <strong>{room.room.code}</strong> dan kode TV <strong className="tv-code">{tvCode.code}</strong> (berlaku {tvCode.minutes} menit).</p>}
              </div>}
            </div>
            <div className="lb-leave-zone"><button type="button" className="lb-exit" disabled={busy} onClick={() => setLeaveOpen(true)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>Keluar dari Room</button></div>
            {error && <p className="error-message" role="alert">{error}</p>}
          </section>
        </div>}
    </section>
    {hostNotice && <div className="lb-modal" role="alertdialog" aria-modal="true" aria-labelledby="lb-host-title" onClick={() => setHostNotice(false)}><div className="lb-modal-card lb-confirm lb-host-notice" onClick={(event) => event.stopPropagation()}>
      <span className="lb-host-icon" aria-hidden="true">♛</span>
      <h2 id="lb-host-title">Kamu adalah Host sekarang</h2>
      <p>Host sebelumnya keluar dari room. Kamu kini mengatur pengaturan ronde dan memulai permainan.</p>
      <div className="lb-confirm-actions"><button type="button" className="lb-btn lb-start" autoFocus onClick={() => setHostNotice(false)}>Mengerti</button></div>
    </div></div>}
    {leaveOpen && room && <div className="lb-modal" role="alertdialog" aria-modal="true" aria-labelledby="lb-leave-title" onClick={() => setLeaveOpen(false)}><div className="lb-modal-card lb-confirm" onClick={(event) => event.stopPropagation()}>
      <h2 id="lb-leave-title">Keluar dari room?</h2>
      <p>{room.isHost ? (room.members.length > 1 ? "Kamu host. Jika keluar, peran host pindah ke pemain lain dan room tetap berjalan untuk mereka." : "Kamu pemain terakhir. Jika keluar, room ini ditutup.") : "Kamu akan keluar dari room ini dan kembali ke katalog."}</p>
      <div className="lb-confirm-actions"><button type="button" className="secondary-button" onClick={() => setLeaveOpen(false)}>Tetap di room</button><button type="button" className="lb-btn lb-danger" disabled={busy} onClick={() => void confirmLeave()}>Ya, keluar</button></div>
    </div></div>}
    {qrOpen && room && <div className="lb-modal" role="dialog" aria-modal="true" aria-label="Kode QR room" onClick={() => setQrOpen(false)}><div className="lb-modal-card" onClick={(event) => event.stopPropagation()}><QrCode path={`/room/${room.room.code}`} label={`Room ${room.room.code}`} /><button type="button" className="secondary-button" onClick={() => setQrOpen(false)}>Tutup</button></div></div>}
    </main>;
}
