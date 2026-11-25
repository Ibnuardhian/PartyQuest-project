"use client";

import { useState } from "react";
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
  const [justSaved, setJustSaved] = useState(false);
  const opposing = undercoverCount + Number(mrWhiteEnabled);
  const fitsPlayers = playerCount < 3 || playerCount - opposing >= 2;
  const dirty = category !== initial.category || undercoverCount !== initial.undercoverCount || mrWhiteEnabled !== initial.mrWhiteEnabled || clueMinutes !== initial.clueMinutes;

  async function save() {
    setSaving(true);
    try {
      await onSave({ category, undercoverCount, mrWhiteEnabled, clueMinutes } satisfies RoomSettings);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  return <div className="lb-editor">
    <div className="lb-set-grid">
      <div className="form-field"><label className="field-label" htmlFor="room-category">Kategori kata</label><CategorySelect id="room-category" value={category} disabled={disabled} onChange={setCategory} /></div>
      <div className="form-field"><label className="field-label" htmlFor="room-undercover">Jumlah Undercover</label><select id="room-undercover" value={undercoverCount} disabled={disabled} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div>
      <div className="form-field"><label className="field-label" htmlFor="room-clue-minutes">Waktu ronde petunjuk</label><select id="room-clue-minutes" value={clueMinutes} disabled={disabled} onChange={(event) => setClueMinutes(Number(event.target.value))}>{CLUE_MINUTES_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatClueMinutes(minutes)}</option>)}</select><small className="lb-hint">Direkomendasikan untuk 2 clue per putaran</small></div>
      <label className="toggle-row lb-toggle"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata, menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} disabled={disabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
    </div>
    {!fitsPlayers && <p className="error-message" role="alert">Sisakan minimal dua pemain Civilian: dengan {playerCount} pemain, pilih lebih sedikit Undercover atau matikan Mr. White.</p>}
    <div className="lb-save-row">
      <span className={justSaved ? "lb-saved on" : "lb-saved"} role="status">{justSaved ? "Tersimpan ✓" : dirty ? "Ada perubahan belum disimpan" : "Pengaturan tersimpan"}</span>
      <button type="button" className={dirty ? "lb-btn lb-save dirty" : "lb-btn lb-save"} disabled={disabled || saving || !dirty || !fitsPlayers} onClick={() => void save()}>{saving ? "MENYIMPAN…" : "SIMPAN PENGATURAN"}</button>
    </div>
  </div>;
}
