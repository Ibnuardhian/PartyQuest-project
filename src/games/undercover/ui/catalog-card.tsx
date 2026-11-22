"use client";

import "./undercover.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCAL_GAME_PATH, readLocalGameSession, type LocalGameSession } from "@/games/undercover/local-session";
import { UNDERCOVER_SETUP_PATH } from "@/games/undercover/paths";

export function UndercoverCatalogCard() {
  const router = useRouter();
  const [savedSession, setSavedSession] = useState<LocalGameSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLocalGameSession().then((session) => { if (!cancelled) setSavedSession(session); });
    return () => { cancelled = true; };
  }, []);

  return <article className="catalog-card catalog-featured catalog-undercover">
    <div className="catalog-art undercover-art"><span className="catalog-emblem" aria-hidden="true">✦</span><span className="art-tag">GAME PERTAMA</span><span className="art-title">UNDER<br />COVER</span><span className="art-subtitle">SATU KATA · BANYAK RAHASIA</span><span className="catalog-file-no" aria-hidden="true">FILE NO. 001</span></div>
    <div className="catalog-card-body">
      <div className="catalog-meta"><span>TEBAK KATA</span><span>3–12 PEMAIN</span></div>
      <h2>Undercover</h2>
      <p>Temukan siapa yang mendapat kata berbeda lewat petunjuk lisan dan voting.</p>
      <button className="primary-button" onClick={() => router.push(savedSession ? `${LOCAL_GAME_PATH}#${savedSession.hash}` : UNDERCOVER_SETUP_PATH)}>{savedSession ? "Lanjutkan permainan" : "Pilih game"} <span>→</span></button>
      {savedSession && <button className="text-button catalog-new-game" onClick={() => router.push(UNDERCOVER_SETUP_PATH)}>Mulai permainan baru</button>}
    </div>
  </article>;
}
