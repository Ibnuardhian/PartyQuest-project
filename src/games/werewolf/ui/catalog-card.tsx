"use client";

import "./werewolf.css";
import { GameCatalogCard } from "@/components/catalog/game-catalog-card";
import { WEREWOLF_SETUP_PATH } from "@/games/werewolf/paths";

export function WerewolfCatalogCard() {
  return <GameCatalogCard
    id="werewolf"
    indexLabel="GAME 02"
    title="Werewolf"
    tagline="Moderator suara · tanpa pemain duduk"
    genre="Deduksi sosial"
    minPlayers={5}
    maxPlayers={16}
    description="Narator suara memandu malam; setiap pemain beraksi diam-diam dari HP masing-masing."
    accentColor="#38bdf8"
    accentInk="#020617"
    bannerClassName="ww-catalog-banner"
    artwork={<span className="werewolf-moon" />}
    action={{ label: "Pilih game", href: WEREWOLF_SETUP_PATH }}
  />;
}
