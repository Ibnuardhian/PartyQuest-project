"use client";

import "./werewolf.css";
import Link from "next/link";
import { WEREWOLF_SETUP_PATH } from "@/games/werewolf/paths";

export function WerewolfCatalogCard() {
  return <article className="catalog-card catalog-werewolf">
    <div className="catalog-art werewolf-art"><span className="art-tag">GAME KEDUA</span><span className="werewolf-moon" aria-hidden="true" /><span className="art-title">WERE<br />WOLF</span><span className="art-subtitle">MODERATOR SUARA · TANPA PEMAIN DUDUK</span></div>
    <div className="catalog-card-body">
      <div className="catalog-meta"><span>DEDUKSI SOSIAL</span><span>5–16 PEMAIN</span></div>
      <h2>Werewolf</h2>
      <p>Narator suara memandu malam; setiap pemain beraksi diam-diam dari HP masing-masing.</p>
      <Link className="primary-button" href={WEREWOLF_SETUP_PATH}>Pilih game <span>→</span></Link>
    </div>
  </article>;
}
