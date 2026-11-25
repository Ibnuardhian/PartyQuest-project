"use client";

import "./quick-join-room.css";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * Header action on the catalog: enter any room code and go to that room's lobby, whatever the game.
 * The lobby already knows the game from the code, so no game-specific link is needed here. The code is
 * checked first so a typo shows a message here instead of an empty lobby.
 */
export function QuickJoinRoom() {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) { setError("Kode room terdiri dari 6 huruf atau angka."); return; }
    setBusy(true);
    setError("");
    try {
      await ensureBrowserGuest();
      const response = await fetch(`/api/rooms/${normalized}`, { cache: "no-store" });
      // 403 means the room exists and the visitor has not joined yet; the lobby then asks for a name.
      if (response.status === 404) { setError("Room tidak ditemukan. Periksa kodenya."); return; }
      if (response.status === 410) { setError("Room ini sudah kedaluwarsa."); return; }
      if (!response.ok && response.status !== 403) { setError("Room belum dapat diperiksa. Coba lagi."); return; }
      router.push(`/room/${normalized}`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="qj" ref={wrapperRef}>
    <button ref={buttonRef} type="button" className="qj-button" aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <svg className="qj-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
      Gabung Room
    </button>
    {open && <div className="qj-panel" id={panelId} role="dialog" aria-label="Gabung ke room">
      <form onSubmit={(event) => void submit(event)}>
        <label className="qj-label" htmlFor={`${panelId}-code`}>Kode room</label>
        <input id={`${panelId}-code`} ref={inputRef} className="qj-input" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABC234" onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "")); setError(""); }} />
        <p className="qj-hint">Masukkan kode 6 karakter dari host. Gamenya dikenali otomatis, bisa Undercover atau Werewolf.</p>
        {error && <p className="qj-error" role="alert">{error}</p>}
        <button className="qj-submit" disabled={busy || code.length !== 6}>{busy ? "Memeriksa…" : "Gabung"}<span aria-hidden="true">→</span></button>
      </form>
    </div>}
  </div>;
}
