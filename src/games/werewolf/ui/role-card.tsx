"use client";

import { useState } from "react";
import type { ClassicRole } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { ALIGNMENT_LABELS } from "@/games/werewolf/ui/labels";

/** Flip card for the private role reveal (tap to turn). Shows name, alignment, and the Indonesian description. */
export function RoleCard({ role, initiallyOpen = false }: { role: ClassicRole; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const info = CLASSIC_ROLE_INFO[role];
  return <button type="button" className={`ww-role-card${open ? " is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-pressed={open} aria-label={open ? `Role kamu: ${info.name}. Ketuk untuk menutup.` : "Ketuk untuk membuka kartu role"}>
    <span className="ww-role-inner">
      <span className="ww-role-face ww-role-back" aria-hidden={open}>
        <span className="ww-role-sigil">☾</span>
        <span className="section-kicker">KARTU RAHASIA</span>
        <small>Ketuk untuk membuka. Pastikan tidak ada yang melihat layarmu.</small>
      </span>
      <span className="ww-role-face ww-role-front" aria-hidden={!open}>
        <span className={`ww-badge ww-badge-${info.alignment.toLowerCase()}`}>{ALIGNMENT_LABELS[info.alignment]}</span>
        <strong>{info.name}</strong>
        <small>{info.description}</small>
      </span>
    </span>
  </button>;
}
