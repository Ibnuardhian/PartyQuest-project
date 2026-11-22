"use client";

import { useState } from "react";
import type { RoomSettingsEditorProps } from "@/games/types";
import { CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES, type ClassicRole } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO, recommendedComposition } from "@/games/werewolf/roles";
import { DEFAULT_ROOM_SETTINGS, type WerewolfRoomSettings } from "@/games/werewolf/server/online";

type Roles = Partial<Record<ClassicRole, number>>;

function recommended(playerCount: number): Roles {
  const count = Math.min(CLASSIC_MAX_PLAYERS, Math.max(CLASSIC_MIN_PLAYERS, playerCount));
  return recommendedComposition(count);
}

/** Host-only lobby editor: AUTO or custom composition, dead-player visibility, and timers. */
export function WerewolfRoomSettingsEditor({ settings, playerCount, disabled, onSave }: RoomSettingsEditorProps) {
  const initial = { ...DEFAULT_ROOM_SETTINGS, ...(settings as Partial<WerewolfRoomSettings>) };
  const [auto, setAuto] = useState(initial.roles === "AUTO");
  const [roles, setRoles] = useState<Roles>(initial.roles === "AUTO" ? recommended(playerCount) : initial.roles);
  const [deadRevealMode, setDeadRevealMode] = useState(initial.deadRevealMode);
  const [nightTurnSeconds, setNightTurnSeconds] = useState(initial.nightTurnSeconds);
  const [dayDiscussionSeconds, setDayDiscussionSeconds] = useState(initial.dayDiscussionSeconds);
  const [saving, setSaving] = useState(false);
  const total = CLASSIC_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
  const preview = auto ? recommended(playerCount) : roles;

  function change(role: ClassicRole, delta: number) {
    setRoles((current) => {
      const next = Math.max(0, Math.min(CLASSIC_ROLE_INFO[role].max, (current[role] ?? 0) + delta));
      return { ...current, [role]: next };
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ roles: auto ? "AUTO" : Object.fromEntries(Object.entries(roles).filter(([, count]) => (count ?? 0) > 0)), deadRevealMode, nightTurnSeconds, dayDiscussionSeconds } satisfies WerewolfRoomSettings);
    } finally {
      setSaving(false);
    }
  }

  return <div className="ww-editor">
    <label className="ww-check"><input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} /> Komposisi otomatis sesuai jumlah pemain</label>
    <ul className="ww-composer">{CLASSIC_ROLES.map((role) => {
      const count = preview[role] ?? 0;
      if (auto && count === 0) return null;
      return <li key={role}>
        <span>{CLASSIC_ROLE_INFO[role].name}{CLASSIC_ROLE_INFO[role].twist ? <small> twist</small> : null}</span>
        {auto ? <strong>{count}</strong> : <span className="ww-stepper">
          <button type="button" aria-label={`Kurangi ${CLASSIC_ROLE_INFO[role].name}`} disabled={disabled || count === 0} onClick={() => change(role, -1)}>−</button>
          <strong>{count}</strong>
          <button type="button" aria-label={`Tambah ${CLASSIC_ROLE_INFO[role].name}`} disabled={disabled || count >= CLASSIC_ROLE_INFO[role].max} onClick={() => change(role, 1)}>+</button>
        </span>}
      </li>;
    })}</ul>
    {!auto && <p className={total === playerCount ? "ww-muted" : "ww-warning"}>{total} role untuk {playerCount} pemain{total === playerCount ? "" : " — harus sama saat permainan dimulai"}.</p>}
    {!auto && <button type="button" className="ww-button" disabled={disabled} onClick={() => setRoles(recommended(playerCount))}>Pakai rekomendasi</button>}
    <label className="ww-label" htmlFor="ww-dead">Pemain tereliminasi</label>
    <select id="ww-dead" className="ww-input" value={deadRevealMode} onChange={(event) => setDeadRevealMode(event.target.value as WerewolfRoomSettings["deadRevealMode"])}>
      <option value="KEEP_HIDDEN">Role tetap rahasia sampai akhir</option>
      <option value="SPECTATOR_REVEAL">Bisa melihat semua role (penonton)</option>
    </select>
    <label className="ww-label" htmlFor="ww-night">Giliran malam per role <span>{nightTurnSeconds} detik</span></label>
    <input id="ww-night" type="range" min={10} max={30} step={1} value={nightTurnSeconds} onChange={(event) => setNightTurnSeconds(Number(event.target.value))} />
    <label className="ww-label" htmlFor="ww-day">Diskusi siang <span>{Math.round(dayDiscussionSeconds / 60)} menit</span></label>
    <input id="ww-day" type="range" min={60} max={600} step={60} value={dayDiscussionSeconds} onChange={(event) => setDayDiscussionSeconds(Number(event.target.value))} />
    <button type="button" className="ww-button ww-primary" disabled={disabled || saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan pengaturan"}</button>
  </div>;
}
