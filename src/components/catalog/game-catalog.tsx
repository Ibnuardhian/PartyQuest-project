import { GameCatalogCard, GameCatalogGrid } from "@/components/catalog/game-catalog-card";
import { QuickJoinRoom } from "@/components/catalog/quick-join-room";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { gameModules } from "@/games/registry";

const COMING_SOON = ["Game berikutnya", "Game baru lainnya"];

/** Platform home: lists games from the registry. Game logic and setup live in src/games/<game>. */
export default function GameCatalog() {
  return <main className="page-shell catalog-page">
    <SiteHeader>
      <div className="topbar-actions">
        <span className="topbar-note"><span className="live-dot" /> Kumpulan game untuk dimainkan bersama</span>
        <QuickJoinRoom />
      </div>
    </SiteHeader>
    <section className="catalog-wrap" id="beranda">
      <div className="catalog-heading"><div className="eyebrow"><span>✦</span> PARTYQUEST · GAME BARENG</div><h1>Pilih game<br /><em>untuk dimainkan.</em></h1><p className="hero-description">Kumpulan permainan sosial untuk dimainkan bersama teman. Game baru akan ditambahkan di sini.</p></div>
      <GameCatalogGrid>
        {gameModules.map(({ key, CatalogCard }) => <CatalogCard key={key} />)}
        {COMING_SOON.slice(0, Math.max(0, 3 - gameModules.length)).map((title, index) => <GameCatalogCard key={title} id={`coming-${index}`} comingSoon indexLabel="Segera hadir" title={title} tagline="Dalam pengembangan" genre="Game sosial" description="Lebih banyak permainan seru akan hadir di PartyQuest." accentColor="#64748b" artwork={<span className="catalog-coming-symbol">{index === 0 ? "◇" : "✳"}</span>} />)}
      </GameCatalogGrid>
    </section>
    <SiteFooter left="MAIN BARENG, PILIH GAME" right={`${gameModules.map((game) => game.title).join(", ")} · tersedia di katalog`} />
  </main>;
}
