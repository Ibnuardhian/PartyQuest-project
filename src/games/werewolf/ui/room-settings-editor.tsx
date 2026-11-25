"use client";

import { useState } from "react";
import { GameButton, GameField, StepperGrid, StepperTile, ThemedSlider, ValidationBanner, type TileTone } from "@/components/ui/game-ui";
import type { RoomSettingsEditorProps } from "@/games/types";
import { CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES, TWIST_ROLES, type ClassicRole } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO, isTwistRole, recommendedAdvancedComposition, recommendedComposition } from "@/games/werewolf/roles";
import { DEFAULT_ROOM_SETTINGS, type WerewolfRoomSettings } from "@/games/werewolf/server/online";

type Roles = Partial<Record<ClassicRole, number>>;

const ALIGNMENT_TONE: Record<string, TileTone> = { WEREWOLF: "danger", VILLAGER: "ally", INDEPENDENT: "neutral" };
const ALIGNMENT_LABEL: Record<string, string> = { WEREWOLF: "Kubu Werewolf", VILLAGER: "Kubu warga", INDEPENDENT: "Independen" };

function recommended(playerCount: number, advanced: boolean): Roles {
  const count = Math.min(CLASSIC_MAX_PLAYERS, Math.max(CLASSIC_MIN_PLAYERS, playerCount));
  return advanced ? recommendedAdvancedComposition(count) : recommendedComposition(count);
}

/** Host-only lobby editor: Advanced mode, AUTO or custom composition, dead-player visibility, and timers. */
export function WerewolfRoomSettingsEditor({ settings, playerCount, disabled, onSave }: RoomSettingsEditorProps) {
  const initial = { ...DEFAULT_ROOM_SETTINGS, ...(settings as Partial<WerewolfRoomSettings>) };
  const [advanced, setAdvanced] = useState(Boolean(initial.advanced));
  const [auto, setAuto] = useState(initial.roles === "AUTO");
  const [roles, setRoles] = useState<Roles>(initial.roles === "AUTO" ? recommended(playerCount, Boolean(initial.advanced)) : initial.roles);
  const [deadRevealMode, setDeadRevealMode] = useState(initial.deadRevealMode);
  const [nightTurnSeconds, setNightTurnSeconds] = useState(initial.nightTurnSeconds);
  const [dayDiscussionSeconds, setDayDiscussionSeconds] = useState(initial.dayDiscussionSeconds);
  const [saving, setSaving] = useState(false);
  const total = CLASSIC_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
  const preview = auto ? recommended(playerCount, advanced) : roles;

  function change(role: ClassicRole, delta: number) {
    setRoles((current) => {
      const next = Math.max(0, Math.min(CLASSIC_ROLE_INFO[role].max, (current[role] ?? 0) + delta));
      return { ...current, [role]: next };
    });
  }

  /** Turning Advanced mode off drops twist roles; their seats become Villagers so the total stays the same. */
  function toggleAdvanced(next: boolean) {
    setAdvanced(next);
    if (next) return;
    setRoles((current) => {
      const twistSeats = TWIST_ROLES.reduce((sum, role) => sum + (current[role] ?? 0), 0);
      const kept = Object.fromEntries(Object.entries(current).filter(([role]) => !isTwistRole(role as ClassicRole))) as Roles;
      return { ...kept, VILLAGER: Math.min(CLASSIC_ROLE_INFO.VILLAGER.max, (kept.VILLAGER ?? 0) + twistSeats) };
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ roles: auto ? "AUTO" : Object.fromEntries(Object.entries(roles).filter(([, count]) => (count ?? 0) > 0)), deadRevealMode, nightTurnSeconds, dayDiscussionSeconds, advanced } satisfies WerewolfRoomSettings);
    } finally {
      setSaving(false);
    }
  }

  return <div className="ww-editor gx-stack">
    <label className="ww-check"><input type="checkbox" checked={advanced} disabled={disabled} onChange={(event) => toggleAdvanced(event.target.checked)} /> Mode lanjutan (role penuh twist)</label>
    <p className="ww-muted">{advanced ? `Role bertwist aktif: ${TWIST_ROLES.map((role) => CLASSIC_ROLE_INFO[role].name).join(", ")}. Komposisi otomatis ikut memakainya.` : "Mode dasar hanya memakai role standar. Nyalakan mode lanjutan untuk menambah role bertwist."}</p>
    <label className="ww-check"><input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} /> Komposisi otomatis sesuai jumlah pemain</label>
    <StepperGrid label="Komposisi role">{CLASSIC_ROLES.map((role) => {
      const count = preview[role] ?? 0;
      if (auto && count === 0) return null;
      if (!advanced && CLASSIC_ROLE_INFO[role].twist) return null;
      const alignment = CLASSIC_ROLE_INFO[role].alignment;
      return <StepperTile key={role} label={CLASSIC_ROLE_INFO[role].name} badge={CLASSIC_ROLE_INFO[role].twist ? "lanjutan" : undefined} count={count} max={CLASSIC_ROLE_INFO[role].max} readOnly={auto} disabled={disabled} tone={ALIGNMENT_TONE[alignment]} toneLabel={ALIGNMENT_LABEL[alignment]} onChange={(next) => change(role, next - count)} />;
    })}</StepperGrid>
    {!auto && <ValidationBanner status={total === playerCount ? "ok" : "warn"} detail={total === playerCount ? "Cocok dengan jumlah pemain" : total < playerCount ? `Tambah ${playerCount - total} role` : `Kurangi ${total - playerCount} role`}>{total} role untuk {playerCount} pemain</ValidationBanner>}
    {!auto && <GameButton type="button" disabled={disabled} onClick={() => setRoles(recommended(playerCount, advanced))}>Pakai rekomendasi</GameButton>}
    <GameField label="Pemain tereliminasi" htmlFor="ww-dead">
      <select id="ww-dead" className="gx-input gx-select" value={deadRevealMode} onChange={(event) => setDeadRevealMode(event.target.value as WerewolfRoomSettings["deadRevealMode"])}>
        <option value="KEEP_HIDDEN">Role tetap rahasia sampai akhir</option>
        <option value="SPECTATOR_REVEAL">Bisa melihat semua role (penonton)</option>
      </select>
    </GameField>
    <ThemedSlider id="ww-night" label="Giliran malam per role" value={nightTurnSeconds} min={10} max={30} unit="detik" onChange={setNightTurnSeconds} />
    <ThemedSlider id="ww-day" label="Diskusi siang" value={Math.round(dayDiscussionSeconds / 60)} min={3} max={10} unit="menit" onChange={(minutes) => setDayDiscussionSeconds(minutes * 60)} />
    <GameButton variant="primary" wide type="button" disabled={disabled || saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan pengaturan"}</GameButton>
  </div>;
}
