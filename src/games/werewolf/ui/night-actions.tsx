"use client";

import { useState } from "react";
import type { WerewolfView } from "@/games/werewolf/ui/labels";

type Perform = (action: Record<string, unknown>) => Promise<void>;
type Player = WerewolfView["public"]["players"][number];

function TargetList({ players, selectedId, marks, disabled, onPick }: { players: Player[]; selectedId?: string | null; marks?: Record<string, number>; disabled: boolean; onPick: (id: string) => void }) {
  if (players.length === 0) return <p className="ww-night-hint">Tidak ada target yang dapat dipilih.</p>;
  return <div className="ww-targets">{players.map((player) => <button key={player.id} type="button" className={`ww-target${selectedId === player.id ? " is-selected" : ""}`} disabled={disabled} aria-pressed={selectedId === player.id} onClick={() => onPick(player.id)}>
    <span>{player.name}</span>
    {marks?.[player.id] ? <span className="ww-claw" aria-label={`${marks[player.id]} pilihan kawanan`}>{"⟋".repeat(marks[player.id]!)}</span> : null}
  </button>)}</div>;
}

/** The `GILIRANMU` panel: shown only to the alive holder(s) of the active night role. */
export function NightActionPanel({ view, busy, perform }: { view: WerewolfView; busy: boolean; perform: Perform }) {
  const [cupidPick, setCupidPick] = useState<string[]>([]);
  const me = view.you.playerId;
  const alive = view.public.players.filter((player) => player.alive);
  const others = alive.filter((player) => player.id !== me);
  const skip = <button type="button" className="ww-button" disabled={busy} onClick={() => void perform({ type: "night-action", actionType: "SKIP" })}>Lewati giliran</button>;

  switch (view.you.role) {
    case "WEREWOLF": {
      if (view.werewolvesDiseased) return <p className="ww-night-hint">Kawananmu tertular penyakit dan tidak dapat berburu malam ini.</p>;
      const marks: Record<string, number> = {};
      for (const target of Object.values(view.wolfTargets ?? {})) if (target) marks[target] = (marks[target] ?? 0) + 1;
      const prey = others.filter((player) => view.knownRoles[player.id] !== "WEREWOLF");
      return <>
        <p className="ww-night-hint">Pilih mangsa bersama kawanan. Tanda cakar menunjukkan pilihan rekanmu. Suara terbanyak menang; seri berarti tidak ada serangan.</p>
        <TargetList players={prey} selectedId={view.wolfTargets?.[me] ?? null} marks={marks} disabled={busy} onPick={(id) => void perform({ type: "wolf-target", targetId: id })} />
        <button type="button" className="ww-button" disabled={busy} onClick={() => void perform({ type: "wolf-target", targetId: null })}>Tidak memangsa</button>
      </>;
    }
    case "DOCTOR": {
      const allowed = alive.filter((player) => player.id !== view.doctor?.lastTarget);
      return <>
        <p className="ww-night-hint">Pilih satu pemain untuk dilindungi malam ini. Kamu tidak boleh melindungi pemain yang sama dua malam berturut-turut.</p>
        <TargetList players={allowed} selectedId={view.doctor?.tonight ?? null} disabled={busy} onPick={(id) => void perform({ type: "night-action", actionType: "DOCTOR_PROTECT", targetId: id })} />
        {skip}
      </>;
    }
    case "SEER": {
      const tonight = view.seerResults.find((result) => result.night === view.public.nightNumber);
      if (tonight) {
        const name = view.public.players.find((player) => player.id === tonight.targetId)?.name ?? "Pemain";
        return <p className="ww-result" role="status"><strong>{name}</strong> terbaca sebagai <strong>{tonight.appearsAs === "WEREWOLF" ? "Werewolf" : "warga"}</strong>.</p>;
      }
      return <>
        <p className="ww-night-hint">Pilih satu pemain untuk diterawang.</p>
        <TargetList players={others} disabled={busy} onPick={(id) => void perform({ type: "night-action", actionType: "SEER_INSPECT", targetId: id })} />
        {skip}
      </>;
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
