"use client";

import { useState } from "react";
import type { WerewolfView } from "@/games/werewolf/ui/labels";
import { ROLE_ICONS } from "@/games/werewolf/ui/role-icons";

type Perform = (action: Record<string, unknown>) => Promise<void>;
type Player = WerewolfView["public"]["players"][number];

function TargetList({ players, selectedId, marks, disabled, onPick }: { players: Player[]; selectedId?: string | null; marks?: Record<string, number>; disabled: boolean; onPick: (id: string) => void }) {
  if (players.length === 0) return <p className="ww-night-hint">Tidak ada target yang dapat dipilih.</p>;
  return <div className="ww-targets">{players.map((player) => <button key={player.id} type="button" className={`ww-target${selectedId === player.id ? " is-selected" : ""}`} disabled={disabled} aria-pressed={selectedId === player.id} onClick={() => onPick(player.id)}>
    <span>{player.name}</span>
    {marks?.[player.id] ? <span className="ww-claw" role="img" aria-label={`${marks[player.id]} pilihan kawanan`}>{Array.from({ length: marks[player.id]! }, (_, index) => <svg key={index} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" focusable="false"><path d={ROLE_ICONS.WEREWOLF.d} /></svg>)}</span> : null}
  </button>)}</div>;
}

const nameOf = (view: WerewolfView, id: string) => view.public.players.find((player) => player.id === id)?.name ?? "Pemain";

/** The `GILIRANMU` panel: shown only to the alive holder(s) of the active night role. */
export function NightActionPanel({ view, busy, perform }: { view: WerewolfView; busy: boolean; perform: Perform }) {
  const [cupidPick, setCupidPick] = useState<string[]>([]);
  const [wolfFirst, setWolfFirst] = useState<string | null>(null);
  const [wolfSecond, setWolfSecond] = useState<string | null>(null);
  const [convert, setConvert] = useState<boolean | null>(null);
  const me = view.you.playerId;
  const alive = view.public.players.filter((player) => player.alive);
  const others = alive.filter((player) => player.id !== me);
  const skip = <button type="button" className="ww-button" disabled={busy} onClick={() => void perform({ type: "night-action", actionType: "SKIP" })}>Lewati giliran</button>;
  const pickOther = (hint: string, actionType: string) => <>
    <p className="ww-night-hint">{hint}</p>
    <TargetList players={others} disabled={busy} onPick={(id) => void perform({ type: "night-action", actionType, targetId: id })} />
    {skip}
  </>;
  // The Dire Wolf and the other pack roles share the Werewolf turn, so the panel follows the turn, not only the role.
  const turn = view.public.activeNightRole ?? view.you.role;

  switch (turn) {
    case "DIRE_WOLF": {
      if (view.direPartnerId) return <p className="ww-result" role="status">Rekan rahasiamu: <strong>{nameOf(view, view.direPartnerId)}</strong>. Jika ia mati, kamu ikut gugur.</p>;
      return pickOther("Pilih satu pemain sebagai rekan rahasiamu. Jika ia mati, kamu langsung ikut tereliminasi.", "DIRE_PARTNER");
    }
    case "WEREWOLF": {
      if (view.werewolvesDiseased) return <p className="ww-night-hint">Kawananmu tertular penyakit dan tidak dapat berburu malam ini.</p>;
      const marks: Record<string, number> = {};
      for (const target of Object.values(view.wolfTargets ?? {})) if (target) marks[target] = (marks[target] ?? 0) + 1;
      for (const target of Object.values(view.wolfSecondTargets ?? {})) if (target) marks[target] = (marks[target] ?? 0) + 1;
      const pack = new Set(["WEREWOLF", "ALPHA_WOLF", "WOLF_CUB", "DIRE_WOLF", "DREAM_WOLF", "LONE_WOLF"]);
      const prey = others.filter((player) => !pack.has(view.knownRoles[player.id] ?? ""));
      const alpha = view.alpha;
      const converting = convert ?? alpha?.converting ?? false;
      const alphaToggle = alpha?.available ? <label className="ww-night-hint"><input type="checkbox" checked={converting} disabled={busy} onChange={(event) => setConvert(event.target.checked)} /> Ubah korban jadi Werewolf (1x per permainan)</label> : null;
      if (view.doubleAttack) {
        const first = wolfFirst ?? view.wolfTargets?.[me] ?? null;
        const second = wolfSecond ?? view.wolfSecondTargets?.[me] ?? null;
        return <>
          <p className="ww-night-hint">Wolf Cub gugur, kawanan murka: pilih dua korban berbeda. Tanda cakar menunjukkan pilihan rekanmu.</p>
          <p className="ww-night-hint">Korban pertama</p>
          <TargetList players={prey} selectedId={first} marks={marks} disabled={busy} onPick={setWolfFirst} />
          <p className="ww-night-hint">Korban kedua</p>
          <TargetList players={prey.filter((player) => player.id !== first)} selectedId={second} marks={marks} disabled={busy} onPick={setWolfSecond} />
          {alphaToggle}
          <button type="button" className="ww-button ww-primary" disabled={busy || !first || !second || first === second} onClick={() => void perform({ type: "wolf-target", targetId: first, secondTargetId: second, convert: converting })}>Kunci dua korban</button>
        </>;
      }
      return <>
        <p className="ww-night-hint">Pilih mangsa bersama kawanan. Tanda cakar menunjukkan pilihan rekanmu. Suara terbanyak menang; seri berarti tidak ada serangan.</p>
        <TargetList players={prey} selectedId={view.wolfTargets?.[me] ?? null} marks={marks} disabled={busy} onPick={(id) => void perform({ type: "wolf-target", targetId: id, convert: converting })} />
        {alphaToggle}
        <button type="button" className="ww-button" disabled={busy} onClick={() => void perform({ type: "wolf-target", targetId: null, convert: false })}>Tidak memangsa</button>
      </>;
    }
    case "SORCERER": {
      const tonight = view.sorcererResults.find((result) => result.night === view.public.nightNumber);
      if (tonight) return <p className="ww-result" role="status"><strong>{nameOf(view, tonight.targetId)}</strong> {tonight.isSeer ? "adalah Seer" : "bukan Seer"}.</p>;
      return pickOther("Pilih satu pemain. Kamu hanya akan tahu apakah dia Seer atau bukan.", "SORCERER_INSPECT");
    }
    case "SPELLCASTER": return pickOther("Pilih satu pemain untuk dibungkam: ia tidak boleh berbicara selama diskusi siang berikutnya.", "SPELLCASTER_SILENCE");
    case "VAMPIRE": return pickOther("Pilih satu pemain untuk digigit. Ia akan binasa setelah voting siang berikutnya, kecuali dilindungi malam ini.", "VAMPIRE_BITE");
    case "DOCTOR": {
      const allowed = alive.filter((player) => player.id !== view.doctor?.lastTarget);
      return <>
        <p className="ww-night-hint">Pilih satu pemain untuk dilindungi malam ini. Kamu tidak boleh melindungi pemain yang sama dua malam berturut-turut.</p>
        <TargetList players={allowed} selectedId={view.doctor?.tonight ?? null} disabled={busy} onPick={(id) => void perform({ type: "night-action", actionType: "DOCTOR_PROTECT", targetId: id })} />
        {skip}
      </>;
    }
    case "SEER":
    case "APPRENTICE_SEER": {
      if (turn === "APPRENTICE_SEER" && view.seerAlive) return <p className="ww-night-hint">Seer masih hidup. Kamu belum mewarisi kekuatannya; tunggu gilirannya selesai.</p>;
      const tonight = view.seerResults.find((result) => result.night === view.public.nightNumber);
      if (tonight) return <p className="ww-result" role="status"><strong>{nameOf(view, tonight.targetId)}</strong> terbaca sebagai <strong>{tonight.appearsAs === "WEREWOLF" ? "Werewolf" : "warga"}</strong>.</p>;
      return pickOther("Pilih satu pemain untuk diterawang.", "SEER_INSPECT");
    }
    case "WITCH": {
      const witch = view.witch!;
      const victim = view.public.players.find((player) => player.id === witch.victimId);
      return <>
        <p className="ww-night-hint">{victim ? <>Korban serangan malam ini: <strong>{victim.name}</strong>.</> : "Tidak ada korban serangan malam ini."}</p>
        {witch.healAvailable && victim && <button type="button" className="ww-button ww-primary" disabled={busy} onClick={() => void perform({ type: "night-action", actionType: "WITCH_HEAL" })}>Pakai Ramuan Penyelamat</button>}
        {witch.poisonAvailable && <>
          <p className="ww-night-hint">Ramuan Racun: pilih satu pemain untuk dieliminasi.</p>
          <TargetList players={others} disabled={busy} onPick={(id) => void perform({ type: "night-action", actionType: "WITCH_POISON", targetId: id })} />
        </>}
        {!witch.healAvailable && !witch.poisonAvailable && <p className="ww-night-hint">Kedua ramuanmu sudah habis.</p>}
        {skip}
      </>;
    }
    case "CUPID": {
      const toggle = (id: string) => setCupidPick((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-2));
      return <>
        <p className="ww-night-hint">Pilih dua pemain yang akan menjadi sepasang kekasih (boleh dirimu sendiri).</p>
        <div className="ww-targets">{alive.map((player) => <button key={player.id} type="button" className={`ww-target${cupidPick.includes(player.id) ? " is-selected" : ""}`} aria-pressed={cupidPick.includes(player.id)} disabled={busy} onClick={() => toggle(player.id)}>{player.name}</button>)}</div>
        <button type="button" className="ww-button ww-primary" disabled={busy || cupidPick.length !== 2} onClick={() => void perform({ type: "night-action", actionType: "CUPID_LINK", targetId: cupidPick[0], secondaryTargetId: cupidPick[1] })}>Panah pasangan ini</button>
        {skip}
      </>;
    }
    case "MASON": {
      const masons = Object.entries(view.knownRoles).filter(([, role]) => role === "MASON").map(([id]) => view.public.players.find((player) => player.id === id)?.name).filter(Boolean);
      return <p className="ww-result">Rekan Mason kamu: <strong>{masons.join(", ")}</strong>. Saling jaga saat diskusi siang.</p>;
    }
    default:
      return null;
  }
}
