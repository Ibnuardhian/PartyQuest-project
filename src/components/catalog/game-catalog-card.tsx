"use client";

import "./game-catalog-card.css";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export interface CatalogAction { label: string; href?: string; onClick?: () => void }

export interface GameCatalogCardProps {
  id: string;
  /** Short eyebrow in the banner, e.g. "GAME 01". */
  indexLabel: string;
  title: string;
  tagline: string;
  genre: string;
  minPlayers?: number;
  maxPlayers?: number;
  description: string;
  /** The game's accent; text on a solid accent fill uses `accentInk`. */
  accentColor: string;
  accentInk?: string;
  /** Decorative motif drawn inside the banner (the game's own identity). */
  artwork?: ReactNode;
  /** Class on the banner for the game's background treatment. */
  bannerClassName?: string;
  action?: CatalogAction;
  secondaryAction?: CatalogAction;
  comingSoon?: boolean;
}

function UsersIcon() {
  return <svg className="gcc-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}

function ActionControl({ action, className, children }: { action: CatalogAction; className: string; children: ReactNode }) {
  return action.href
    ? <Link className={className} href={action.href}>{children}</Link>
    : <button type="button" className={className} onClick={action.onClick}>{children}</button>;
}

/**
 * One catalog card shape for every game: equal height, fixed banner, the same meta row, title,
 * two-line description, and a bottom-aligned action. Only the accent and banner artwork differ.
 */
export function GameCatalogCard(props: GameCatalogCardProps) {
  const { id, indexLabel, title, tagline, genre, minPlayers, maxPlayers, description, accentColor, accentInk = "#020617", artwork, bannerClassName, action, secondaryAction, comingSoon } = props;
  const style = { "--game-accent": accentColor, "--game-accent-ink": accentInk } as CSSProperties;
  const players = minPlayers && maxPlayers ? `${minPlayers}–${maxPlayers} Pemain` : null;
  return <article className={`gcc${comingSoon ? " gcc-coming" : ""}`} style={style} aria-labelledby={`gcc-${id}-title`}>
    <div className={`gcc-banner${bannerClassName ? ` ${bannerClassName}` : ""}`} aria-hidden="true">
      <div className="gcc-art">{artwork}</div>
      <span className="gcc-eyebrow">{indexLabel}</span>
      <div className="gcc-banner-text"><span className="gcc-banner-title">{title}</span><span className="gcc-tagline">{tagline}</span></div>
    </div>
    <div className="gcc-body">
      <div className="gcc-meta">
        <span className="gcc-genre">{genre}</span>
        {players && <span className="gcc-players"><UsersIcon />{players}</span>}
      </div>
      <h3 id={`gcc-${id}-title`} className="gcc-title">{title}</h3>
      <p className="gcc-desc">{description}</p>
      <div className="gcc-actions">
        {comingSoon || !action
          ? <span className="gcc-button gcc-button-disabled">Segera hadir</span>
          : <ActionControl action={action} className="gcc-button">{action.label}<span className="gcc-arrow" aria-hidden="true">→</span></ActionControl>}
        {secondaryAction && <ActionControl action={secondaryAction} className="gcc-link">{secondaryAction.label}</ActionControl>}
      </div>
    </div>
  </article>;
}

/** Responsive catalog grid: one column on phones, two on tablets, three on wide screens. */
export function GameCatalogGrid({ children }: { children: ReactNode }) {
  return <div className="gcc-grid" aria-label="Katalog game">{children}</div>;
}
