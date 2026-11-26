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
  APPRENTICE_SEER: "Warga biasa yang mewarisi kekuatan menerawang Seer secara otomatis begitu Seer tereliminasi.",
  PRINCE: "Bangsawan desa yang selamat dari eksekusi voting satu kali: identitasmu terbongkar dan eksekusi hari itu dibatalkan.",
  TROUBLEMAKER: "Satu kali dalam permainan saat voting siang, kamu memicu voting kedua sehingga desa mengeksekusi satu orang lagi hari itu.",
  SPELLCASTER: "Pilih satu pemain setiap malam untuk dibungkam sehingga ia dilarang berbicara sepanjang diskusi siang berikutnya.",
  LONE_WOLF: "Bangun bersama kawanan Werewolf, tetapi kamu menang sendirian saat menjadi satu-satunya anggota kawanan yang tersisa.",
  VAMPIRE: "Gigit satu korban setiap malam yang binasa setelah voting siang berikutnya; Werewolf tidak dapat membunuhmu.",
  ALPHA_WOLF: "Pemimpin kawanan yang satu kali per permainan bisa mengubah korban mangsa malam menjadi Werewolf baru alih-alih membunuhnya.",
  SORCERER: "Penyihir sekutu Werewolf yang setiap malam menerawang satu pemain untuk mencari tahu apakah dia Seer.",
  WOLF_CUB: "Jika ia tereliminasi kapan pun, kawanan Werewolf murka dan dapat memangsa dua pemain pada malam berikutnya.",
  DIRE_WOLF: "Pilih satu rekan rahasia pada malam pertama; saat rekanmu mati, kamu langsung ikut tereliminasi.",
  DREAM_WOLF: "Werewolf yang tertidur sepanjang malam, tidak ikut bangun, namun tetap dikenali sesama Werewolf.",
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

/** Display order of the full roster (20 cards). */
const CARDS: CardData[] = [
  playable("WEREWOLF"), playable("ALPHA_WOLF"), playable("WOLF_CUB"), playable("DIRE_WOLF"), playable("DREAM_WOLF"), playable("SORCERER"), playable("VILLAGER"), playable("SEER"), playable("APPRENTICE_SEER"), playable("DOCTOR"),
  playable("HUNTER"), playable("MASON"), playable("DISEASE"), playable("TANNER"), playable("LYCAN"),
  playable("CURSED"), playable("WITCH"), playable("CUPID"), playable("MINION"), playable("MAYOR"),
  playable("PRINCE"), playable("TROUBLEMAKER"), playable("SPELLCASTER"), playable("LONE_WOLF"), playable("VAMPIRE"),
];

/** Cards are grouped by side so players can compare each team's roles at a glance. */
const SIDES: Array<{ tone: Tone; title: string; note: string }> = [
  { tone: "good", title: "Warga", note: "Tim desa: temukan dan eksekusi semua Werewolf" },
  { tone: "evil", title: "Jahat", note: "Tim Werewolf: musnahkan warga desa" },
  { tone: "neutral", title: "Netral", note: "Punya tujuan menang sendiri" },
];

function RoleCard({ card, flipped, expanded, onToggle }: { card: CardData; flipped: boolean; expanded: boolean; onToggle: () => void }) {
  const icon = ROLE_ICONS[card.key];
  // The slot keeps the grid cell in place while a tapped card expands to the full screen on phones.
  return <span className="ww-rg-slot"><button type="button" className={`ww-rg-card tone-${card.tone}${card.soon ? " is-soon" : ""}${flipped ? " is-flipped" : ""}${expanded ? " is-expanded" : ""}`} aria-pressed={flipped} aria-label={`${card.name}, ${card.faction}${card.soon ? ", segera hadir" : ""}. ${flipped ? "Sembunyikan" : "Lihat"} kemampuan`} onClick={onToggle}>
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
        <span className="ww-rg-foot">{card.soon ? "Segera hadir · " : ""}{expanded ? "Ketuk untuk menutup" : "Ketuk untuk balik"}</span>
      </span>
    </span>
  </button></span>;
}

/** Phones: a flipped card fills the screen (with a margin) so its description is large and never clipped. */
const PHONE_QUERY = "(max-width: 640px)";

/** "Daftar role": a compact trigger that opens a modal with all roles as flip cards. */
export function RoleFlipGrid() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [flipped, setFlipped] = useState<Partial<Record<RoleIconKey, boolean>>>({});
  const [expanded, setExpanded] = useState<RoleIconKey | null>(null);

  function collapse() {
    if (expanded) setFlipped((current) => ({ ...current, [expanded]: false }));
    setExpanded(null);
  }

  function toggle(key: RoleIconKey) {
    const open = Boolean(flipped[key]);
    if (!window.matchMedia(PHONE_QUERY).matches) { setFlipped((current) => ({ ...current, [key]: !open })); return; }
    if (open) { setFlipped((current) => ({ ...current, [key]: false })); setExpanded(null); return; }
    setFlipped((current) => ({ ...current, [key]: true }));
    setExpanded(key);
  }

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const onClose = () => { setFlipped({}); setExpanded(null); };
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, []);

  // Escape closes an expanded card first (not the whole list), and the card shrinks if the screen grows past phone size.
  useEffect(() => {
    const node = dialog.current;
    if (!node || !expanded) return;
    const query = window.matchMedia(PHONE_QUERY);
    const onCancel = (event: Event) => { event.preventDefault(); setFlipped((current) => ({ ...current, [expanded]: false })); setExpanded(null); };
    const onResize = () => { if (!query.matches) setExpanded(null); };
    node.addEventListener("cancel", onCancel);
    query.addEventListener("change", onResize);
    return () => { node.removeEventListener("cancel", onCancel); query.removeEventListener("change", onResize); };
  }, [expanded]);

  return <>
    <button type="button" className="ww-rg-trigger" onClick={() => dialog.current?.showModal()}>Daftar role ({CARDS.length}) <span aria-hidden="true">↗</span></button>
    <dialog ref={dialog} className="ww-rg-dialog" aria-label="Daftar role Werewolf" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="ww-rg-panel">
        {expanded && <span className="ww-rg-backdrop" onClick={collapse} aria-hidden="true" />}
        <div className="ww-rg-bar"><div><h2>Daftar role ({CARDS.length})</h2><p>Ketuk kartu untuk melihat kemampuan</p></div><button type="button" className="ww-rg-close" autoFocus onClick={() => dialog.current?.close()} aria-label="Tutup daftar role">✕</button></div>
        {SIDES.map((side) => {
          const cards = CARDS.filter((card) => card.tone === side.tone).sort((a, b) => Number(a.soon) - Number(b.soon));
          return <details key={side.tone} className={`ww-rg-side tone-${side.tone}`} open>
            <summary className="ww-rg-side-title"><i className="ww-rg-dot" aria-hidden="true" />{side.title} <span>{cards.length}</span><small>{side.note}</small><b className="ww-rg-chevron" aria-hidden="true">▾</b></summary>
            <div className="ww-rg-grid">{cards.map((card) => <RoleCard key={card.key} card={card} flipped={Boolean(flipped[card.key])} expanded={expanded === card.key} onToggle={() => toggle(card.key)} />)}</div>
          </details>;
        })}
      </div>
    </dialog>
  </>;
}
