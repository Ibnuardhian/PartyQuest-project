"use client";

import "./werewolf.css";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { AccentPill, FilledInput, GameButton, GameCard, GameCardHeading, GameCardSection, GameField, GameLinkButton } from "@/components/ui/game-ui";
import { RoleFlipGrid } from "@/games/werewolf/ui/role-flip-grid";
import { WEREWOLF_ONUW_PATH, WEREWOLF_VOICE_PILOT_PATH } from "@/games/werewolf/paths";
import { ensureBrowserGuest } from "@/lib/auth/browser-guest";

/** Werewolf setup: create or join a Classic room. Composition and timers are set by the host in the lobby. */
export default function WerewolfSetup({ showVoicePilot = false }: { showVoicePilot?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void ensureBrowserGuest().then(() => { if (!cancelled) setReady(true); }).catch((cause: unknown) => { if (!cancelled) setMessage(cause instanceof Error ? cause.message : "Sesi tamu belum siap."); });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent, mode: "create" | "join") {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await ensureBrowserGuest();
      const response = await fetch(mode === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { gameKey: "werewolf", displayName: name } : { displayName: name, code }),
      });
      const payload = await response.json() as { data?: { code?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.code) throw new Error(payload.error?.message ?? "Room belum dapat diproses.");
      router.push(`/room/${payload.data.code}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Room belum dapat diproses.");
    } finally {
      setWorking(false);
    }
  }

  return <main className="page-shell werewolf-theme">
    <SiteHeader><span className="topbar-note"><span className="live-dot" /> Werewolf · Online Room</span></SiteHeader>
    <section className="ww-setup">
      <div className="ww-setup-copy">
        <Link className="text-button" href="/">← Kembali ke katalog</Link>
        <span className="section-kicker">GAME · WEREWOLF</span>
        <h1>Desa ini <em>menyimpan rahasia.</em></h1>
        <p className="ww-setup-lead">Tidak ada yang perlu jadi moderator. Narator suara memandu malam, setiap pemain beraksi dari HP masing-masing, dan layar malam yang gelap serta mini-game ketuk membuat tidak ada yang bisa menebak role dari gerak-gerik.</p>
        <ul className="ww-facts"><li>5–16 pemain</li><li>Satu HP per pemain</li><li>Narator suara di HP host atau TV</li></ul>
        <RoleFlipGrid />
        {/* Hidden for now: the default narrator is the ElevenLabs pack. Set WEREWOLF_VOICE_PILOT=1 to show the voice page link. */}
        {showVoicePilot && <AccentPill href={WEREWOLF_VOICE_PILOT_PATH}><SpeakerIcon /> Coba suara moderator <span aria-hidden="true">→</span></AccentPill>}
      </div>

      <GameCard aria-labelledby="ww-setup-title">
        <GameCardSection>
          <GameCardHeading kicker="MODE 1 · HYBRID CLASSIC" title="Buat atau gabung" id="ww-setup-title" />
          <GameField label="Nama tampilan" htmlFor="ww-name">
            <FilledInput id="ww-name" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama yang dilihat teman" />
          </GameField>
          <form className="gx-field" onSubmit={(event) => void submit(event, "create")}>
            <GameButton variant="primary" wide disabled={!ready || working || !name.trim()}>Buat room baru</GameButton>
            <p className="gx-hint">Host mengatur komposisi role, mode pemain tereliminasi, dan durasi di lobi.</p>
          </form>
          <form onSubmit={(event) => void submit(event, "join")}>
            <GameField label="Kode room" htmlFor="ww-code">
              <div className="gx-row">
                <FilledInput id="ww-code" code maxLength={6} autoCapitalize="characters" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ""))} placeholder="ABC234" />
                <GameButton highlighted={code.length === 6} disabled={!ready || working || code.length !== 6 || !name.trim()}>Gabung</GameButton>
              </div>
            </GameField>
          </form>
          {!ready && !message && <p className="gx-hint">Menghubungkan sesi tamu…</p>}
          {message && <p className="ww-alert" role="alert">{message}</p>}
        </GameCardSection>
        <GameCardSection divided>
          <GameCardHeading kicker="MODE 2 · ONUW (1 HP + KARTU FISIK)" description="Satu HP di tengah meja memvalidasi kartu dan memandu malam dengan suara." />
          <GameLinkButton wide href={WEREWOLF_ONUW_PATH} icon={<PhoneIcon />}>Main ONUW</GameLinkButton>
        </GameCardSection>
      </GameCard>
    </section>
    <SiteFooter left="WEREWOLF" right="Game kedua di katalog PartyQuest" />
  </main>;
}

function SpeakerIcon() {
  return <svg className="gx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>;
}

function PhoneIcon() {
  return <svg className="gx-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>;
}
