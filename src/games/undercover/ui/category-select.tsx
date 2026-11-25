"use client";

import "./category-select.css";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Category } from "@/games/undercover/contract";
import { CATEGORY_LABELS } from "@/games/undercover/ui/labels";
import { countWordPairs } from "@/games/undercover/words";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const OPTION_HEIGHT = 44;

interface MenuPosition { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

/** "52 pasangan": every round uses one pair of related words. */
function PairBadge({ category }: { category: Category }) {
  return <span className="cs-badge">{countWordPairs(category)} pasangan</span>;
}

/**
 * Dossier-styled replacement for the native category <select>: it shows how many word pairs each category
 * has. The menu is rendered in a portal with fixed positioning, because the setup card clips overflow, and
 * it opens upward when there is no room below. Follows the combobox/listbox keyboard pattern.
 */
export function CategorySelect({ id, value, onChange, disabled = false }: { id: string; value: Category; onChange: (category: Category) => void; disabled?: boolean }) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, CATEGORIES.indexOf(value)));
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const wanted = CATEGORIES.length * OPTION_HEIGHT + 12;
    const below = window.innerHeight - rect.bottom - gap - 8;
    const above = rect.top - gap - 8;
    const openUp = below < wanted && above > below;
    // A half-width trigger (two fields per row on phones) would squeeze the rows, so the menu is at least 260px wide and kept on screen.
    const width = Math.max(rect.width, Math.min(260, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPosition({ left, width, maxHeight: Math.max(160, openUp ? above : below), ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }) });
  }, []);

  function openMenu() {
    if (disabled) return;
    setActive(Math.max(0, CATEGORIES.indexOf(value)));
    place();
    setOpen(true);
    // Safari and Firefox on macOS do not focus a button on click; keyboard navigation needs the focus.
    triggerRef.current?.focus();
  }

  function choose(category: Category) {
    onChange(category);
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActive((index) => (index + 1) % CATEGORIES.length); break;
      case "ArrowUp": event.preventDefault(); setActive((index) => (index - 1 + CATEGORIES.length) % CATEGORIES.length); break;
      case "Home": event.preventDefault(); setActive(0); break;
      case "End": event.preventDefault(); setActive(CATEGORIES.length - 1); break;
      case "Enter":
      case " ": event.preventDefault(); choose(CATEGORIES[active]!); break;
      case "Escape": event.preventDefault(); setOpen(false); break;
      case "Tab": setOpen(false); break;
    }
  }

  return <>
    <button ref={triggerRef} id={id} type="button" className="cs-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined} disabled={disabled} onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKeyDown}>
      <span className="cs-trigger-label">{CATEGORY_LABELS[value]}</span>
      <PairBadge category={value} />
      <svg className="cs-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && position && createPortal(
      <ul ref={menuRef} id={listId} role="listbox" aria-label="Kategori kata" className="cs-menu" style={{ left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}>
        {CATEGORIES.map((category, index) => <li key={category} id={`${listId}-${index}`} role="option" aria-selected={category === value} className={`cs-option${index === active ? " is-active" : ""}${category === value ? " is-selected" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => choose(category)}>
          <span className="cs-check" aria-hidden="true">{category === value ? "✓" : ""}</span>
          <span className="cs-option-label">{CATEGORY_LABELS[category]}</span>
          <PairBadge category={category} />
        </li>)}
      </ul>,
      document.body,
    )}
  </>;
}
