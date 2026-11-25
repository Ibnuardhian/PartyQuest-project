import { HUNTING_ROLES, PACK_ROLES, type Alignment, type ClassicGameState, type ClassicRole, type DeathReason, type NightActions, type VoteRecord, type WinnerFaction } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";

/** Pure rule helpers. Functions named `apply*`/`resolve*` mutate the draft they receive. */

export interface Death { playerId: string; reason: DeathReason }

export function alignmentOf(role: ClassicRole): Alignment {
  return CLASSIC_ROLE_INFO[role].alignment;
}

/** Pack members count as Werewolves for the win check. */
export function isPackRole(role: ClassicRole) {
  return PACK_ROLES.includes(role);
}

/** What the Seer reads: the pack and the Lycan appear as Werewolf, everyone else (Minion, Sorcerer included) as a villager. */
export function appearsAsWerewolf(role: ClassicRole) {
  return isPackRole(role) || role === "LYCAN";
}

export function emptyNight(): NightActions {
  return {
    wolfTargets: {}, wolfSecondTargets: {}, alphaConvert: false, doctorTarget: null, seerTarget: null, witchHeal: false, witchPoisonTarget: null, cupidLink: null,
    sorcererTarget: null, silenceTarget: null, biteTarget: null, direTarget: null, actedPlayerIds: [],
  };
}

export function alivePlayers(state: ClassicGameState) {
  return state.public.players.filter((player) => player.alive);
}

export function isAlive(state: ClassicGameState, playerId: string) {
  return state.public.players.some((player) => player.id === playerId && player.alive);
}

/**
 * Marks players dead, follows the Lovers chain (partner dies of heartbreak) and the Dire Wolf's bond (the Dire
 * Wolf dies with its partner), queues Hunters, and arms the Wolf Cub's double attack.
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
    const bond = draft.secret.direBond;
    if (bond && bond.partnerId === death.playerId) queue.push({ playerId: bond.direId, reason: "BOND" });
    const role = draft.secret.roles[death.playerId];
    if (role === "HUNTER" && death.reason !== "DEAD_AFK") draft.public.hunterQueue.push(death.playerId);
    // The pack picks two victims on the night after a Wolf Cub falls, whatever the cause.
    if (role === "WOLF_CUB") draft.secret.doubleAttackNight = draft.public.nightNumber + 1;
  }
  return deaths;
}

/** Plurality of the alive hunting pack's picks for one slot; a tie means the pack did not agree. */
function consensus(state: ClassicGameState, picks: Record<string, string | null>, exclude: string | null): string | null {
  const tally = new Map<string, number>();
  for (const [wolfId, targetId] of Object.entries(picks)) {
    if (!targetId || targetId === exclude || !isAlive(state, wolfId) || !HUNTING_ROLES.includes(state.secret.roles[wolfId]!) || !isAlive(state, targetId)) continue;
    if (isPackRole(state.secret.roles[targetId]!)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }
  const best = Math.max(0, ...tally.values());
  const leaders = [...tally.entries()].filter(([, count]) => count === best && best > 0).map(([id]) => id);
  return leaders.length === 1 ? leaders[0]! : null;
}

/** First attack slot (the only one on a normal night). */
export function wolfConsensus(state: ClassicGameState): string | null {
  return consensus(state, state.secret.night.wolfTargets, null);
}

/** True on the night after a Wolf Cub died: the pack may pick a second, different victim. */
export function isDoubleAttackNight(state: ClassicGameState) {
  return state.secret.doubleAttackNight === state.public.nightNumber;
}

/** Tonight's victims in order: one normally, up to two on a double-attack night. */
export function wolfVictims(state: ClassicGameState): string[] {
  const first = wolfConsensus(state);
  const victims = first ? [first] : [];
  if (isDoubleAttackNight(state)) {
    const second = consensus(state, state.secret.night.wolfSecondTargets, first);
    if (second) victims.push(second);
  }
  return victims;
}

/** Tonight's first attacked player as the Witch sees it (before Doctor/Witch protection). */
export function currentWolfVictim(state: ClassicGameState) {
  return state.secret.werewolvesDiseased ? null : wolfConsensus(state);
}

/**
 * DAWN_RESOLUTION: kills, protections, Alpha conversion, Cursed conversion, Disease, Vampire immunity and bite,
 * poison, Spellcaster silence, and the Lovers/Dire Wolf chains.
 */
export function resolveDawn(draft: ClassicGameState): Death[] {
  const secret = draft.secret;
  const night = secret.night;
  const diseaseBlocked = secret.werewolvesDiseased;
  secret.werewolvesDiseased = false;
  const victims = diseaseBlocked ? [] : wolfVictims(draft);
  const initial: Death[] = [];
  victims.forEach((victim, index) => {
    // Doctor protects the named player; the Witch's potion saves the first victim.
    if (victim === night.doctorTarget || (index === 0 && night.witchHeal)) return;
    const role = secret.roles[victim]!;
    if (role === "VAMPIRE") return;
    if (night.alphaConvert && !secret.alphaUsed) {
      secret.alphaUsed = true;
      secret.roles[victim] = "WEREWOLF";
      secret.notices.push({ playerId: victim, message: "Kamu diserang Werewolf dan kini berubah menjadi Werewolf. Bangunlah bersama kawananmu malam berikutnya." });
      return;
    }
    if (role === "CURSED") {
      secret.roles[victim] = "WEREWOLF";
      secret.notices.push({ playerId: victim, message: "Kamu diserang Werewolf dan kini berubah menjadi Werewolf. Bangunlah bersama kawananmu malam berikutnya." });
      return;
    }
    initial.push({ playerId: victim, reason: "WEREWOLF" });
    if (role === "DISEASE") secret.werewolvesDiseased = true;
  });
  if (night.witchPoisonTarget && isAlive(draft, night.witchPoisonTarget)) initial.push({ playerId: night.witchPoisonTarget, reason: "POISON" });
  const bitten = night.biteTarget && isAlive(draft, night.biteTarget) && night.biteTarget !== night.doctorTarget ? night.biteTarget : null;
  const deaths = applyDeaths(draft, initial);
  if (bitten && isAlive(draft, bitten) && !draft.public.doomedIds.includes(bitten)) draft.public.doomedIds.push(bitten);
  draft.public.silencedId = night.silenceTarget && isAlive(draft, night.silenceTarget) ? night.silenceTarget : null;
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
  LONE_WOLF: "Lone Wolf menjadi satu-satunya anggota kawanan dan jumlahnya menyamai pemain lain.",
  VAMPIRE: "Vampire bertahan hingga hanya tersisa dua pemain hidup.",
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
  const vampire = alive.find((player) => roles[player.id] === "VAMPIRE");
  if (vampire && alive.length <= 2) return { faction: "VAMPIRE", playerIds: [vampire.id] };
  const packAlive = alive.filter((player) => isPackRole(roles[player.id]!));
  const aliveWolves = packAlive.length;
  const team = (alignment: Alignment) => state.public.players.filter((player) => alignmentOf(roles[player.id]!) === alignment && roles[player.id] !== "LONE_WOLF").map((player) => player.id);
  if (aliveWolves === 0 && !vampire) return { faction: "VILLAGER", playerIds: team("VILLAGER") };
  if (aliveWolves > 0 && aliveWolves >= alive.length - aliveWolves) {
    if (packAlive.every((player) => roles[player.id] === "LONE_WOLF")) return { faction: "LONE_WOLF", playerIds: packAlive.map((player) => player.id) };
    return { faction: "WEREWOLF", playerIds: team("WEREWOLF") };
  }
  return null;
}
