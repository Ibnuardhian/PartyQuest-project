import type { Alignment, ClassicGameState, ClassicRole, DeathReason, NightActions, VoteRecord, WinnerFaction } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";

/** Pure rule helpers. Functions named `apply*`/`resolve*` mutate the draft they receive. */

export interface Death { playerId: string; reason: DeathReason }

export function alignmentOf(role: ClassicRole): Alignment {
  return CLASSIC_ROLE_INFO[role].alignment;
}

export function emptyNight(): NightActions {
  return { wolfTargets: {}, doctorTarget: null, seerTarget: null, witchHeal: false, witchPoisonTarget: null, cupidLink: null, actedPlayerIds: [] };
}

export function alivePlayers(state: ClassicGameState) {
  return state.public.players.filter((player) => player.alive);
}

export function isAlive(state: ClassicGameState, playerId: string) {
  return state.public.players.some((player) => player.id === playerId && player.alive);
}

/**
 * Marks players dead, follows the Lovers chain (partner dies of heartbreak), and queues Hunters.
 * A Hunter removed for AFK does not get a revenge shot.
 */
export function applyDeaths(draft: ClassicGameState, initial: Death[]): Death[] {
  const deaths: Death[] = [];
  const queue = [...initial];
  while (queue.length > 0) {
    const death = queue.shift()!;
    const player = draft.public.players.find((item) => item.id === death.playerId);
    if (!player || !player.alive) continue;
    player.alive = false;
    player.deathReason = death.reason;
    deaths.push(death);
    const lovers = draft.secret.lovers;
    if (lovers?.includes(death.playerId)) {
      queue.push({ playerId: lovers[0] === death.playerId ? lovers[1] : lovers[0], reason: "HEARTBREAK" });
    }
    if (draft.secret.roles[death.playerId] === "HUNTER" && death.reason !== "DEAD_AFK") draft.public.hunterQueue.push(death.playerId);
  }
  return deaths;
}

/** Plurality among alive Werewolves' picks; a tie means the pack did not agree and nobody is attacked. */
export function wolfConsensus(state: ClassicGameState): string | null {
  const tally = new Map<string, number>();
  for (const [wolfId, targetId] of Object.entries(state.secret.night.wolfTargets)) {
    if (!targetId || !isAlive(state, wolfId) || state.secret.roles[wolfId] !== "WEREWOLF" || !isAlive(state, targetId)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }
  const best = Math.max(0, ...tally.values());
  const leaders = [...tally.entries()].filter(([, count]) => count === best && best > 0).map(([id]) => id);
  return leaders.length === 1 ? leaders[0]! : null;
}

/** Tonight's attacked player as the Witch sees it (before Doctor/Witch protection). */
export function currentWolfVictim(state: ClassicGameState) {
  return state.secret.werewolvesDiseased ? null : wolfConsensus(state);
}

/** DAWN_RESOLUTION: kill, protections, Cursed conversion, Disease, poison, Lovers chain. */
export function resolveDawn(draft: ClassicGameState): Death[] {
  const secret = draft.secret;
  const night = secret.night;
  const diseaseBlocked = secret.werewolvesDiseased;
  secret.werewolvesDiseased = false;
  const victim = diseaseBlocked ? null : wolfConsensus(draft);
  const initial: Death[] = [];
  if (victim && victim !== night.doctorTarget && !night.witchHeal) {
    if (secret.roles[victim] === "CURSED") {
      secret.roles[victim] = "WEREWOLF";
      secret.notices.push({ playerId: victim, message: "Kamu diserang Werewolf dan kini berubah menjadi Werewolf. Bangunlah bersama kawananmu malam berikutnya." });
    } else {
      initial.push({ playerId: victim, reason: "WEREWOLF" });
      if (secret.roles[victim] === "DISEASE") secret.werewolvesDiseased = true;
    }
  }
  if (night.witchPoisonTarget && isAlive(draft, night.witchPoisonTarget)) initial.push({ playerId: night.witchPoisonTarget, reason: "POISON" });
  const deaths = applyDeaths(draft, initial);
  secret.doctorLastTarget = night.doctorTarget;
  draft.public.log.push({ type: "DAWN", night: draft.public.nightNumber, deaths, diseaseBlocked });
  secret.night = emptyNight();
  return deaths;
}

/** Hidden votes become a voter -> target matrix. Mayor counts twice. */
export function tallyVotes(state: ClassicGameState) {
  const records: VoteRecord[] = state.public.players
    .filter((player) => player.id in state.secret.votes)
    .map((player) => ({ voterId: player.id, targetId: state.secret.votes[player.id] ?? null, weight: state.secret.roles[player.id] === "MAYOR" ? 2 : 1 }));
  const totals = new Map<string, number>();
  for (const record of records) if (record.targetId) totals.set(record.targetId, (totals.get(record.targetId) ?? 0) + record.weight);
  const best = Math.max(0, ...totals.values());
  const leaders = best > 0 ? [...totals.entries()].filter(([, total]) => total === best).map(([id]) => id) : [];
  return { records, leaders };
}

const WIN_REASONS: Record<WinnerFaction, string> = {
  VILLAGER: "Semua Werewolf telah tereliminasi.",
  WEREWOLF: "Jumlah Werewolf menyamai atau melebihi pemain lain yang tersisa.",
  TANNER: "Tanner dieksekusi oleh warga dan menang sendirian.",
  LOVERS: "Pasangan kekasih beda kubu menjadi dua penyintas terakhir.",
};

export function winReason(faction: WinnerFaction) {
  return WIN_REASONS[faction];
}

/** Win check (docs/02 §1.5). Tanner is handled at execution time because it overrides everything. */
export function evaluateWinner(state: ClassicGameState): { faction: WinnerFaction; playerIds: string[] } | null {
  const alive = alivePlayers(state);
  const roles = state.secret.roles;
  const lovers = state.secret.lovers;
  if (lovers && alive.length === 2 && lovers.every((id) => alive.some((player) => player.id === id))) {
    const alignments = new Set(lovers.map((id) => alignmentOf(roles[id]!)));
    if (alignments.has("WEREWOLF") && alignments.has("VILLAGER")) return { faction: "LOVERS", playerIds: [...lovers] };
  }
  const aliveWolves = alive.filter((player) => roles[player.id] === "WEREWOLF").length;
  const team = (alignment: Alignment) => state.public.players.filter((player) => alignmentOf(roles[player.id]!) === alignment).map((player) => player.id);
  if (aliveWolves === 0) return { faction: "VILLAGER", playerIds: team("VILLAGER") };
  if (aliveWolves >= alive.length - aliveWolves) return { faction: "WEREWOLF", playerIds: team("WEREWOLF") };
  return null;
}
