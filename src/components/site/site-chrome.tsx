import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="PartyQuest beranda"><span className="brand-mark">P</span>partyquest</Link>
    {children}
  </header>;
}

export function SiteFooter({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <footer className="footer"><span>PARTYQUEST <span className="footer-star">✦</span> {left}</span><span>{right}</span></footer>;
}

export function ConnectionNote({ label }: { label: string }) {
  return <span className="topbar-note"><span className="live-dot" />{label}</span>;
}
