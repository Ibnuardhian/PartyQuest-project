import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { defaultOnlineGame, gameModules } from "@/games/registry";

const COMING_SOON = ["Game berikutnya", "Game baru lainnya"];

/** Platform home: lists games from the registry. Game logic and setup live in src/games/<game>. */
export default function GameCatalog() {
  return <main className="page-shell">
    <SiteHeader>
      <div className="topbar-actions">
        <span className="topbar-note"><span className="live-dot" /> Kumpulan game untuk dimainkan bersama</span>
        {defaultOnlineGame?.onlineSetupHref && <Link className="online-link" href={defaultOnlineGame.onlineSetupHref}>Online Room ↗</Link>}
      </div>
    </SiteHeader>
    <section className="catalog-wrap" id="beranda">
      <div className="catalog-heading"><div className="eyebrow"><span>✦</span> PARTYQUEST · GAME BARENG</div><h1>Pilih game<br /><em>untuk dimainkan.</em></h1><p className="hero-description">Kumpulan permainan sosial untuk dimainkan bersama teman. Game baru akan ditambahkan di sini.</p></div>
      <div className="catalog-grid" aria-label="Katalog game">
        {gameModules.map(({ key, CatalogCard }) => <CatalogCard key={key} />)}
        {COMING_SOON.slice(0, Math.max(0, 3 - gameModules.length)).map((title, index) => <article className="catalog-card catalog-coming" key={title}><div className={`catalog-art coming-art coming-art-${index + 1}`}><span className="coming-symbol">{index === 0 ? "◇" : "✳"}</span><span className="art-tag">SEGERA HADIR</span></div><div className="catalog-card-body"><div className="catalog-meta"><span>GAME SOSIAL</span><span>DALAM PENGEMBANGAN</span></div><h2>{title}</h2><p>Lebih banyak permainan seru akan hadir di PartyQuest.</p><span className="coming-label">Segera hadir</span></div></article>)}
      </div>
    </section>
    <SiteFooter left="MAIN BARENG, PILIH GAME" right={`${gameModules.map((game) => game.title).join(", ")} · tersedia di katalog`} />
  </main>;
}
