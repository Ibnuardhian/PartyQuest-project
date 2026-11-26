"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSettingsEditorProps } from "@/games/types";
import { CLUE_MINUTES_OPTIONS, DEFAULT_CLUE_MINUTES, formatClueMinutes, type Category } from "@/games/undercover/contract";
import { CategorySelect } from "@/games/undercover/ui/category-select";

interface RoomSettings { category: Category; undercoverCount: number; mrWhiteEnabled: boolean; clueMinutes: number }

/** Host-only lobby editor for an Undercover room: category, roles, and the spoken-clue time per player. */
export function UndercoverRoomSettingsEditor({ settings, playerCount, disabled, onSave }: RoomSettingsEditorProps) {
  const initial: RoomSettings = { category: "campuran", undercoverCount: 1, mrWhiteEnabled: false, clueMinutes: DEFAULT_CLUE_MINUTES, ...(settings as Partial<RoomSettings>) };
  const [category, setCategory] = useState<Category>(initial.category);
  const [undercoverCount, setUndercoverCount] = useState(initial.undercoverCount);
  const [mrWhiteEnabled, setMrWhiteEnabled] = useState(initial.mrWhiteEnabled);
  const [clueMinutes, setClueMinutes] = useState(initial.clueMinutes);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [failedKey, setFailedKey] = useState("");
  const saveRef = useRef(onSave);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  const opposing = undercoverCount + Number(mrWhiteEnabled);
  const fitsPlayers = playerCount < 3 || playerCount - opposing >= 2;
  const dirty = category !== initial.category || undercoverCount !== initial.undercoverCount || mrWhiteEnabled !== initial.mrWhiteEnabled || clueMinutes !== initial.clueMinutes;

  // Every change is saved on its own after a short pause; there is no save button to remember.
  // After a refused save it waits for the host to change something instead of retrying in a loop.
  const key = `${category}|${undercoverCount}|${mrWhiteEnabled}|${clueMinutes}`;
  useEffect(() => {
    if (!dirty || !fitsPlayers || disabled || saving || failedKey === key) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await saveRef.current({ category, undercoverCount, mrWhiteEnabled, clueMinutes } satisfies RoomSettings);
        setStatus("saved");
      } catch {
        setStatus("failed");
        setFailedKey(key);
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [category, undercoverCount, mrWhiteEnabled, clueMinutes, dirty, fitsPlayers, disabled, saving, failedKey, key]);

  const label = saving ? "Menyimpan…" : dirty && fitsPlayers ? "Menyimpan perubahan…" : status === "failed" && dirty && failedKey === key ? "Gagal menyimpan, coba ubah lagi" : status === "saved" ? "Tersimpan ✓" : "Perubahan tersimpan otomatis";

  return <div className="lb-editor">
    <div className="lb-set-grid">
      <div className="form-field"><label className="field-label" htmlFor="room-category">Kategori kata</label><CategorySelect id="room-category" value={category} disabled={disabled} onChange={setCategory} /></div>
      <div className="form-field"><label className="field-label" htmlFor="room-undercover">Jumlah Undercover</label><select id="room-undercover" value={undercoverCount} disabled={disabled} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div>
      <div className="form-field"><label className="field-label" htmlFor="room-clue-minutes">Waktu ronde petunjuk</label><select id="room-clue-minutes" value={clueMinutes} disabled={disabled} onChange={(event) => setClueMinutes(Number(event.target.value))}>{CLUE_MINUTES_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatClueMinutes(minutes)}</option>)}</select><small className="lb-hint">Direkomendasikan 3 menit: cukup untuk 2 clue per pemain</small></div>
      <label className="toggle-row lb-toggle"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata, menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} disabled={disabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
    </div>
    {!fitsPlayers && <p className="error-message" role="alert">Sisakan minimal dua pemain Civilian: dengan {playerCount} pemain, pilih lebih sedikit Undercover atau matikan Mr. White.</p>}
    <p className={status === "saved" && !dirty && !saving ? "lb-saved on" : "lb-saved"} role="status">{label}</p>
  </div>;
}
