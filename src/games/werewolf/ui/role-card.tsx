"use client";

import { useEffect, useState } from "react";
import type { ClassicRole } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { ALIGNMENT_LABELS } from "@/games/werewolf/ui/labels";

/** Phones: a tapped card flips and fills the screen (with a margin) so the description is large enough to read. */
const PHONE_QUERY = "(max-width: 640px)";

/**
 * Flip card for the private role reveal (tap to turn). Shows name, alignment, and the Indonesian
 * description. On a phone the open card expands to nearly the whole screen; tapping the card or the
 * dark area (or pressing Escape) shrinks it back. `initiallyOpen` cards start flipped and inline, and
 * return to that state instead of hiding the role.
 */
export function RoleCard({ role, initiallyOpen = false }: { role: ClassicRole; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [expanded, setExpanded] = useState(false);
  const info = CLASSIC_ROLE_INFO[role];

  function collapse() {
    setExpanded(false);
    setOpen(initiallyOpen);
  }

  function toggle() {
    if (!window.matchMedia(PHONE_QUERY).matches) {
      setOpen((value) => !value);
      setExpanded(false);
    } else if (expanded) {
      collapse();
    } else {
      setOpen(true);
      setExpanded(true);
    }
  }

  // While expanded: keep the page behind from scrolling, close on Escape, and shrink if the screen grows past phone size.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const query = window.matchMedia(PHONE_QUERY);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setExpanded(false); setOpen(initiallyOpen); } };
    const onResize = () => { if (!query.matches) setExpanded(false); };
    window.addEventListener("keydown", onKey);
    query.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      query.removeEventListener("change", onResize);
    };
  }, [expanded, initiallyOpen]);

  return <span className="ww-role-slot">
    {expanded && <span className="ww-role-backdrop" onClick={collapse} aria-hidden="true" />}
    <button type="button" className={`ww-role-card${open ? " is-open" : ""}${expanded ? " is-expanded" : ""}`} onClick={toggle} aria-pressed={open} aria-expanded={expanded} aria-label={open ? `Role kamu: ${info.name}. Ketuk untuk menutup.` : "Ketuk untuk membuka kartu role"}>
      <span className="ww-role-inner">
        <span className="ww-role-face ww-role-back" aria-hidden={open}>
          <span className="ww-role-content">
            <span className="ww-role-sigil">☾</span>
            <span className="section-kicker">KARTU RAHASIA</span>
            <small>Ketuk untuk membuka. Pastikan tidak ada yang melihat layarmu.</small>
          </span>
        </span>
        <span className="ww-role-face ww-role-front" aria-hidden={!open}>
          <span className="ww-role-content">
            <span className={`ww-badge ww-badge-${info.alignment.toLowerCase()}`}>{ALIGNMENT_LABELS[info.alignment]}</span>
            <strong>{info.name}</strong>
            <small>{info.description}</small>
            <em className="ww-role-hint">Ketuk untuk menutup</em>
          </span>
        </span>
      </span>
    </button>
  </span>;
}
