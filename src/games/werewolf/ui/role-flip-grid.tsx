"use client";

import { useEffect, useRef, useState } from "react";
import { type Alignment, type ClassicRole } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { ROLE_ICONS, type RoleIconKey } from "@/games/werewolf/ui/role-icons";

/** One-sentence ability summaries shown on the back of each role card. */
const ABILITY: Record<ClassicRole, string> = {
  WEREWOLF: "Bangun setiap malam bersama sesama Werewolf untuk memangsa satu warga desa secara diam-diam.",
  VILLAGER: "Andalkan intuisi dan analisis selama diskusi siang untuk mengungkap siapa Werewolf di antara warga.",
  SEER: "Terawang satu pemain setiap malam untuk mengetahui apakah ia berpihak pada Werewolf atau warga.",
  DOCTOR: "Lindungi satu pemain setiap malam dari serangan Werewolf, namun tidak boleh orang yang sama berturut-turut.",
  HUNTER: "Saat tereliminasi kapan pun, kamu langsung menembak satu pemain lain untuk ikut mati bersamamu.",
  MASON: "Kenali sesama anggota perkumpulan Mason pada malam pertama agar bisa saling percaya di siang hari.",
  DISEASE: "Jika dimangsa Werewolf, wabah di tubuhmu membuat para Werewolf tidak bisa membunuh pada malam berikutnya.",
  TANNER: "Menang sendirian jika kamu berhasil memancing warga untuk mengeksekusimu lewat voting siang hari.",
  LYCAN: "Warga desa setia yang membawa darah kutukan sehingga terbaca sebagai Werewolf saat diterawang Seer.",
  CURSED: "Warga biasa yang tidak akan mati jika dimangsa Werewolf, melainkan bangkit menjadi Werewolf baru.",
  WITCH: "Miliki satu Ramuan Penyelamat untuk menghidupkan korban malam dan satu Ramuan Racun untuk mengeliminasi target.",
  CUPID: "Panah dua pemain di malam pertama agar jatuh cinta sehidup semati, jika satu mati, pasangannya ikut mati.",
  MINION: "Kaki tangan manusia yang mengetahui identitas para Werewolf dan membantu mengacaukan voting warga.",
  MAYOR: "Pemimpin desa yang memiliki bobot suara dua kali lipat setiap kali voting eksekusi siang berlangsung.",
};

type Tone = "good" | "evil" | "neutral";
interface CardData { key: RoleIconKey; name: string; faction: string; tone: Tone; twist: boolean; ability: string; soon: boolean }

const TONE: Record<Alignment, { label: string; tone: Tone }> = {
  VILLAGER: { label: "Warga", tone: "good" },
  WEREWOLF: { label: "Jahat", tone: "evil" },
  INDEPENDENT: { label: "Netral", tone: "neutral" },
};

function playable(role: ClassicRole): CardData {
  const info = CLASSIC_ROLE_INFO[role];
  const faction = TONE[info.alignment];
  // Cursed starts as a villager and can turn; say so on the card instead of hiding the twist.
  return { key: role, name: info.name, faction: role === "CURSED" ? "Warga → Jahat" : faction.label, tone: faction.tone, twist: info.twist, ability: ABILITY[role], soon: false };
}

/** Roles in the design roster that the Classic engine does not deal yet; shown with a "Segera" tag. */
const SOON: Record<string, CardData> = {
  APPRENTICE_SEER: { key: "APPRENTICE_SEER", name: "Apprentice Seer", faction: "Warga", tone: "good", twist: false, soon: true, ability: "Warga biasa yang akan mewarisi kekuatan menerawang milik Seer secara otomatis jika Seer asli tereliminasi dari permainan." },
  PRINCE: { key: "PRINCE", name: "Prince", faction: "Warga", tone: "good", twist: true, soon: true, ability: "Bangsawan desa yang kebal dari eksekusi voting siang pertama, identitasmu akan langsung terbongkar dan eksekusi hari itu dibatalkan." },
  TROUBLEMAKER: { key: "TROUBLEMAKER", name: "Troublemaker", faction: "Warga", tone: "good", twist: true, soon: true, ability: "Satu kali dalam permainan pada siang hari, kamu dapat memicu kekacauan sehingga desa melakukan dua kali voting eksekusi berturut-turut." },
  SPELLCASTER: { key: "SPELLCASTER", name: "Spellcaster", faction: "Warga", tone: "good", twist: true, soon: true, ability: "Pilih satu pemain setiap malam untuk dibungkam sihir sehingga ia dilarang berbicara sepatah kata pun sepanjang diskusi siang berikutnya." },
  LONE_WOLF: { key: "LONE_WOLF", name: "Lone Wolf", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Bangun bersama Werewolf lain di malam hari, namun kamu hanya menang jika berhasil menjadi satu-satunya pemain yang bertahan hidup di akhir permainan." },
  ALPHA_WOLF: { key: "ALPHA_WOLF", name: "Alpha Wolf", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Pemimpin kawanan Werewolf yang satu kali per permainan bisa mengubah korban mangsa malam menjadi Werewolf baru alih-alih membunuhnya." },
  SORCERER: { key: "SORCERER", name: "Sorcerer", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Penyihir sekutu Werewolf yang bangun setiap malam untuk menerawang satu pemain demi menemukan siapa Seer di desa ini." },
  WOLF_CUB: { key: "WOLF_CUB", name: "Wolf Cub", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Anak serigala yang setia, jika ia tereliminasi kapan pun, kawanan Werewolf murka dan dapat memangsa dua warga pada malam berikutnya." },
  DIRE_WOLF: { key: "DIRE_WOLF", name: "Dire Wolf", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Pilih satu pemain sebagai rekan rahasia pada malam pertama, kapan pun rekanmu itu mati, kamu langsung ikut tereliminasi bersamanya." },
  DREAM_WOLF: { key: "DREAM_WOLF", name: "Dream Wolf", faction: "Jahat", tone: "evil", twist: true, soon: true, ability: "Werewolf yang tertidur pulas sepanjang malam sehingga tidak ikut bangun bersama kawanan, namun identitasmu tetap diketahui oleh sesama Werewolf." },
  VAMPIRE: { key: "VAMPIRE", name: "Vampire", faction: "Netral / Jahat", tone: "neutral", twist: true, soon: true, ability: "Pilih satu korban setiap malam yang baru akan tereliminasi pada voting siang berikutnya, dan kamu kebal dari serangan Werewolf di malam hari." },
};

/** Display order of the full roster (20 cards). */
const CARDS: CardData[] = [
  playable("WEREWOLF"), SOON.ALPHA_WOLF!, SOON.WOLF_CUB!, SOON.DIRE_WOLF!, SOON.DREAM_WOLF!, SOON.SORCERER!, playable("VILLAGER"), playable("SEER"), SOON.APPRENTICE_SEER!, playable("DOCTOR"),
  playable("HUNTER"), playable("MASON"), playable("DISEASE"), playable("TANNER"), playable("LYCAN"),
  playable("CURSED"), playable("WITCH"), playable("CUPID"), playable("MINION"), playable("MAYOR"),
  SOON.PRINCE!, SOON.TROUBLEMAKER!, SOON.SPELLCASTER!, SOON.LONE_WOLF!, SOON.VAMPIRE!,
];

/** Cards are grouped by side so players can compare each team's roles at a glance. */
const SIDES: Array<{ tone: Tone; title: string; note: string }> = [
  { tone: "good", title: "Warga", note: "Tim desa: temukan dan eksekusi semua Werewolf" },
  { tone: "evil", title: "Jahat", note: "Tim Werewolf: musnahkan warga desa" },
  { tone: "neutral", title: "Netral", note: "Punya tujuan menang sendiri" },
];

function RoleCard({ card, flipped, onToggle }: { card: CardData; flipped: boolean; onToggle: () => void }) {
  const icon = ROLE_ICONS[card.key];
  return <button type="button" className={`ww-rg-card tone-${card.tone}${card.soon ? " is-soon" : ""}${flipped ? " is-flipped" : ""}`} aria-pressed={flipped} aria-label={`${card.name}, ${card.faction}${card.soon ? ", segera hadir" : ""}. ${flipped ? "Sembunyikan" : "Lihat"} kemampuan`} onClick={onToggle}>
    <span className="ww-rg-inner">
      <span className="ww-rg-face ww-rg-front">
        <span className="ww-rg-top"><i className="ww-rg-dot" aria-hidden="true" /><span className="ww-rg-tags">{card.twist && <b className="ww-rg-twist">Twist</b>}{card.soon && <b className="ww-rg-twist ww-rg-soon">Segera</b>}</span></span>
        <span className="ww-rg-medal"><svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" focusable="false"><path d={icon.d} /></svg></span>
        <span className="ww-rg-name">{card.name}</span>
        <span className="ww-rg-hint" aria-hidden="true">↻</span>
      </span>
      <span className="ww-rg-face ww-rg-back">
        <span className="ww-rg-head"><strong>{card.name}</strong><em className="ww-rg-pill">{card.faction}</em></span>
        <span className="ww-rg-text">{card.ability}</span>
        <span className="ww-rg-foot">{card.soon ? "Segera hadir · " : ""}Ketuk untuk balik</span>
      </span>
    </span>
  </button>;
}

/** "Daftar role": a compact trigger that opens a modal with all roles as flip cards. */
export function RoleFlipGrid() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [flipped, setFlipped] = useState<Partial<Record<RoleIconKey, boolean>>>({});

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const onClose = () => setFlipped({});
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, []);

  return <>
    <button type="button" className="ww-rg-trigger" onClick={() => dialog.current?.showModal()}>Daftar role ({CARDS.length}) <span aria-hidden="true">↗</span></button>
    <dialog ref={dialog} className="ww-rg-dialog" aria-label="Daftar role Werewolf" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="ww-rg-panel">
        <div className="ww-rg-bar"><div><h2>Daftar role ({CARDS.length})</h2><p>Ketuk kartu untuk melihat kemampuan</p></div><button type="button" className="ww-rg-close" autoFocus onClick={() => dialog.current?.close()} aria-label="Tutup daftar role">✕</button></div>
        {SIDES.map((side) => {
          const cards = CARDS.filter((card) => card.tone === side.tone).sort((a, b) => Number(a.soon) - Number(b.soon));
          return <details key={side.tone} className={`ww-rg-side tone-${side.tone}`} open>
            <summary className="ww-rg-side-title"><i className="ww-rg-dot" aria-hidden="true" />{side.title} <span>{cards.length}</span><small>{side.note}</small><b className="ww-rg-chevron" aria-hidden="true">▾</b></summary>
            <div className="ww-rg-grid">{cards.map((card) => <RoleCard key={card.key} card={card} flipped={Boolean(flipped[card.key])} onToggle={() => setFlipped((current) => ({ ...current, [card.key]: !current[card.key] }))} />)}</div>
          </details>;
        })}
      </div>
    </dialog>
  </>;
}
