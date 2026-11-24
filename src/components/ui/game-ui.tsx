"use client";

import "./game-ui.css";
import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/**
 * Theme-aware building blocks for game landing and setup screens. They hold no game rules: a game's
 * theme sets `--game-accent` (and `--game-accent-ink`, the text color on the accent) and these
 * components derive the tints, focus rings, and primary fill from it.
 */

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/** Level 1 surface: the elevated card on the page canvas. */
export function GameCard({ className, children, ...props }: ComponentProps<"section">) {
  return <section className={cx("gx-card", className)} {...props}>{children}</section>;
}

/** Card section with consistent vertical rhythm; `divided` draws a rule above it. */
export function GameCardSection({ divided, className, children }: { divided?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx("gx-section", divided && "gx-section-divided", className)}>{children}</div>;
}

export function GameCardHeading({ kicker, title, description, id }: { kicker: string; title?: ReactNode; description?: ReactNode; id?: string }) {
  return <div className="gx-heading">
    <span className="gx-kicker">{kicker}</span>
    {title && <h2 id={id} className="gx-title">{title}</h2>}
    {description && <p className="gx-hint">{description}</p>}
  </div>;
}

/** Label + control + optional hint, stacked with a fixed gap. */
export function GameField({ label, htmlFor, hint, aside, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return <div className="gx-field">
    <div className="gx-label-row"><label className="gx-label" htmlFor={htmlFor}>{label}</label>{aside}</div>
    {children}
    {hint && <p className="gx-hint">{hint}</p>}
  </div>;
}

/** Level 2 recessed input. `code` renders a tactile monospaced room-code field. */
export function FilledInput({ code, className, ...props }: ComponentProps<"input"> & { code?: boolean }) {
  return <input className={cx("gx-input", code && "gx-input-code", className)} {...props} />;
}

type ButtonVariant = "primary" | "secondary";
interface ButtonLook { variant?: ButtonVariant; icon?: ReactNode; wide?: boolean; highlighted?: boolean }

function buttonClass({ variant = "secondary", wide, highlighted }: ButtonLook, className?: string) {
  return cx("gx-button", `gx-button-${variant}`, wide && "gx-button-wide", highlighted && "is-highlighted", className);
}

/** Primary = solid accent fill with a soft glow; secondary = solid slate. `highlighted` tints a secondary in the accent. */
export function GameButton({ variant, icon, wide, highlighted, className, children, ...props }: ComponentProps<"button"> & ButtonLook) {
  return <button className={buttonClass({ variant, wide, highlighted }, className)} {...props}>{icon}{children}</button>;
}

export function GameLinkButton({ variant, icon, wide, className, children, ...props }: ComponentProps<typeof Link> & ButtonLook) {
  return <Link className={buttonClass({ variant, wide }, className)} {...props}>{icon}{children}</Link>;
}

/** Accent-tinted pill for secondary discoveries such as an audio preview. */
export function AccentPill({ className, children, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cx("gx-pill", className)} {...props}>{children}</Link>;
}

export type TileTone = "danger" | "ally" | "neutral";
const TONE_LABEL: Record<TileTone, string> = { danger: "Kubu lawan", ally: "Kubu kawan", neutral: "Netral" };

/** Counter tile: muted at 0, accent-highlighted above 0, with a 36 px touch-friendly stepper. */
export function StepperTile({ label, badge, count, min = 0, max, onChange, tone, toneLabel, disabled, readOnly }: { label: string; badge?: string; count: number; min?: number; max: number; onChange?: (next: number) => void; tone?: TileTone; toneLabel?: string; disabled?: boolean; readOnly?: boolean }) {
  return <li className={cx("gx-tile", count > 0 ? "is-active" : "is-idle")}>
    <span className="gx-tile-label">
      {tone && <span className={`gx-dot gx-dot-${tone}`} role="img" aria-label={toneLabel ?? TONE_LABEL[tone]} title={toneLabel ?? TONE_LABEL[tone]} />}
      <span className="gx-tile-name">{label}</span>
      {badge && <small className="gx-tile-badge">{badge}</small>}
    </span>
    {readOnly ? <span className="gx-stepper"><strong>{count}</strong></span> : <span className="gx-stepper">
      <button type="button" aria-label={`Kurangi ${label}`} disabled={disabled || count <= min} onClick={() => onChange?.(count - 1)}>−</button>
      <strong aria-live="polite">{count}</strong>
      <button type="button" aria-label={`Tambah ${label}`} disabled={disabled || count >= max} onClick={() => onChange?.(count + 1)}>+</button>
    </span>}
  </li>;
}

export function StepperGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className="gx-tile-grid" aria-label={label}>{children}</ul>;
}

/** Range input with an accent progress fill, a large thumb, and the value in a pill. */
export function ThemedSlider({ id, label, value, min, max, step = 1, unit, onChange }: { id: string; label: ReactNode; value: number; min: number; max: number; step?: number; unit?: string; onChange: (next: number) => void }) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return <div className="gx-field">
    <div className="gx-label-row"><label className="gx-label" htmlFor={id}>{label}</label><span className="gx-value">{value}{unit ? ` ${unit}` : ""}</span></div>
    <input id={id} className="gx-slider" type="range" min={min} max={max} step={step} value={value} style={{ "--gx-fill": `${percent}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
  </div>;
}

/** Inline validation bar: `ok` uses a success tint with a check, `warn` an amber tint. */
export function ValidationBanner({ status, children, detail }: { status: "ok" | "warn"; children: ReactNode; detail?: ReactNode }) {
  return <div className={`gx-banner gx-banner-${status}`} role="status">
    <span className="gx-banner-main">
      <svg className="gx-icon" viewBox="0 0 24 24" aria-hidden="true">{status === "ok" ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></>}</svg>
      {children}
    </span>
    {detail && <span className="gx-banner-detail">{detail}</span>}
  </div>;
}
