"use client";

import { useState } from "react";
import type { RoomSettingsEditorProps } from "@/games/types";
import { CLUE_MINUTES_OPTIONS, DEFAULT_CLUE_MINUTES, formatClueMinutes, type Category } from "@/games/undercover/contract";
import { CATEGORY_LABELS } from "@/games/undercover/ui/labels";

interface RoomSettings { category: Category; undercoverCount: number; mrWhiteEnabled: boolean; clueMinutes: number }

/** Host-only lobby editor for an Undercover room: category, roles, and the spoken-clue time per player. */
export function UndercoverRoomSettingsEditor({ settings, playerCount, disabled, onSave }: RoomSettingsEditorProps) {
  const initial: RoomSettings = { category: "campuran", undercoverCount: 1, mrWhiteEnabled: false, clueMinutes: DEFAULT_CLUE_MINUTES, ...(settings as Partial<RoomSettings>) };
  const [category, setCategory] = useState<Category>(initial.category);
  const [undercoverCount, setUndercoverCount] = useState(initial.undercoverCount);
  const [mrWhiteEnabled, setMrWhiteEnabled] = useState(initial.mrWhiteEnabled);
  const [clueMinutes, setClueMinutes] = useState(initial.clueMinutes);
  const [saving, setSaving] = useState(false);
  const opposing = undercoverCount + Number(mrWhiteEnabled);
  const fitsPlayers = playerCount < 3 || playerCount - opposing >= 2;

  async function save() {
    setSaving(true);
    try {
      await onSave({ category, undercoverCount, mrWhiteEnabled, clueMinutes } satisfies RoomSettings);
    } finally {
      setSaving(false);
    }
  }

  return <div className="uc-online-stack">
    <div className="form-field"><label className="field-label" htmlFor="room-category">Kategori kata</label><select id="room-category" value={category} disabled={disabled} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="form-field"><label className="field-label" htmlFor="room-undercover">Jumlah Undercover</label><select id="room-undercover" value={undercoverCount} disabled={disabled} onChange={(event) => setUndercoverCount(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} orang</option>)}</select></div>
    <label className="toggle-row"><span><strong>Tambahkan Mr. White</strong><small>Tak punya kata—bisa menang dengan menebak</small></span><input type="checkbox" checked={mrWhiteEnabled} disabled={disabled} onChange={(event) => setMrWhiteEnabled(event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
    {!fitsPlayers && <p className="error-message" role="alert">Sisakan minimal dua pemain Civilian: dengan {playerCount} pemain, pilih lebih sedikit Undercover atau matikan Mr. White.</p>}
    <div className="form-field"><label className="field-label" htmlFor="room-clue-minutes">Waktu ronde petunjuk</label><select id="room-clue-minutes" value={clueMinutes} disabled={disabled} onChange={(event) => setClueMinutes(Number(event.target.value))}>{CLUE_MINUTES_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatClueMinutes(minutes)}</option>)}</select></div>
    <p className="status-note">Petunjuk diberikan bebas secara lisan dalam satu timer yang sama di semua HP. Sebelum voting pertama ada 2 putaran petunjuk; setelah voting tanpa pemenang, tiap ronde berikutnya 1 putaran.</p>
    <button type="button" className="primary-button" disabled={disabled || saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan pengaturan"} <span>→</span></button>
  </div>;
}
