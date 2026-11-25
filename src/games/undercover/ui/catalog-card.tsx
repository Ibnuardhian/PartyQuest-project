"use client";

import "./undercover.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameCatalogCard } from "@/components/catalog/game-catalog-card";
import { LOCAL_GAME_PATH, readLocalGameSession, type LocalGameSession } from "@/games/undercover/local-session";
import { UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";

export const UNDERCOVER_ACCENT = { color: "#e11d48", ink: "#fff1f2" } as const;

export function UndercoverCatalogCard() {
  const router = useRouter();
  const [savedSession, setSavedSession] = useState<LocalGameSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLocalGameSession().then((session) => { if (!cancelled) setSavedSession(session); });
    return () => { cancelled = true; };
  }, []);

  return <GameCatalogCard
    id="undercover"
    indexLabel="GAME 01"
    title="Undercover"
    tagline="Satu kata · banyak rahasia"
    genre="Tebak kata"
    minPlayers={3}
    maxPlayers={12}
    description="Temukan siapa yang mendapat kata berbeda lewat petunjuk lisan dan voting."
    accentColor={UNDERCOVER_ACCENT.color}
    accentInk={UNDERCOVER_ACCENT.ink}
    bannerClassName="uc-catalog-banner"
    artwork={<><span className="uc-catalog-rings" /><span className="uc-catalog-file">FILE NO. 001</span></>}
    action={{ label: savedSession ? "Lanjutkan permainan" : "Pilih game", onClick: () => router.push(savedSession ? `${LOCAL_GAME_PATH}#${savedSession.hash}` : UNDERCOVER_SETUP_PATH) }}
    secondaryAction={savedSession ? { label: "Mulai permainan baru", href: UNDERCOVER_SETUP_PATH } : undefined}
  />;
}
