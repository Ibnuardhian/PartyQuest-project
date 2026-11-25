import {
  FIRST_NIGHT_ONLY, HUNTING_ROLES, NIGHT_ORDER, PHASE_SECONDS,
  type Actor, type ClassicAction, type ClassicContext, type ClassicGameState, type ClassicPhase, type ClassicPlayer, type ClassicRole, type NightRole, type WinnerFaction,
} from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO } from "@/games/werewolf/roles";
import { validateClassicSettings } from "@/games/werewolf/engine/classic/settings";
import { alivePlayers, applyDeaths, appearsAsWerewolf, currentWolfVictim, emptyNight, evaluateWinner, isAlive, isDoubleAttackNight, isPackRole, resolveDawn, tallyVotes, winReason, type Death } from "@/games/werewolf/engine/classic/resolve";

/**
 * Werewolf Classic (Mode 1) state machine. Pure: no React, database, or network.
 * Every function returns a new state; inputs are never mutated.
 */

export class ClassicRuleError extends Error {}

function fail(message: string): never {
  throw new ClassicRuleError(message);
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

export function createClassicGame(players: Array<{ id: string; name: string }>, rawSettings: unknown, ctx: ClassicContext): ClassicGameState {
  const settings = validateClassicSettings(rawSettings, players.length);
  if (new Set(players.map((player) => player.id)).size !== players.length) fail("ID pemain harus unik.");
  if (new Set(players.map((player) => player.name.trim().toLocaleLowerCase("id-ID"))).size !== players.length) fail("Nama pemain harus berbeda.");
  const deck = (Object.entries(settings.roles) as Array<[ClassicRole, number]>).flatMap(([role, count]) => Array.from({ length: count }, () => role));
  const dealt = shuffle(deck, ctx.random ?? Math.random);
  const roles = Object.fromEntries(players.map((player, index) => [player.id, dealt[index]!])) as Record<string, ClassicRole>;
  return {
    settings,
    public: {
      phase: "ROLE_REVEAL", nightNumber: 0, dayNumber: 0, phaseDeadlineAt: null, nightQueue: [], nightTurnIndex: 0,
      players: players.map((player): ClassicPlayer => ({ id: player.id, name: player.name.trim(), alive: true, deathReason: null, canVote: true, hasAfkPenalty: false })),
      readyPlayerIds: [], skipDiscussionIds: [], votedPlayerIds: [], tiedPlayerIds: [], lastVoteReveal: null,
      hunterQueue: [], resumePhase: null, winner: null, winReason: null, log: [],
      silencedId: null, doomedIds: [], revealedPrinceIds: [], secondVoteQueued: false,
    },
    secret: {
      roles, originalRoles: { ...roles }, lovers: null, doctorLastTarget: null, witchHealUsed: false, witchPoisonUsed: false,
      werewolvesDiseased: false, night: emptyNight(), seerResults: [], sorcererResults: [], direBond: null, alphaUsed: false,
      doubleAttackNight: null, troublemakerUsed: false, votes: {}, notices: [],
    },
  };
}

export function activeNightRole(state: ClassicGameState): NightRole | null {
  return state.public.phase === "NIGHT_TURN" ? state.public.nightQueue[state.public.nightTurnIndex] ?? null : null;
}

/** Roles whose holders act in a night turn: the Werewolf turn belongs to every hunting pack member. */
export function turnRoles(turn: NightRole): readonly ClassicRole[] {
  return turn === "WEREWOLF" ? HUNTING_ROLES : [turn];
}

/** A turn is in the queue when its role is in the composition; the Werewolf turn also covers the wolf-side hunters. */
function turnConfigured(settings: ClassicGameState["settings"], turn: NightRole) {
  return turnRoles(turn).some((role) => (settings.roles[role] ?? 0) > 0);
}

function seerAlive(state: ClassicGameState) {
  return alivePlayers(state).some((player) => state.secret.roles[player.id] === "SEER");
}

// ---------- phase transitions (mutate a draft) ----------

function setPhase(draft: ClassicGameState, phase: ClassicPhase, seconds: number | null, now: number) {
  draft.public.phase = phase;
  draft.public.phaseDeadlineAt = seconds === null ? null : new Date(now + seconds * 1000).toISOString();
}

function endGame(draft: ClassicGameState, winner: { faction: WinnerFaction; playerIds: string[] }) {
  draft.public.winner = winner;
  draft.public.winReason = winReason(winner.faction);
  draft.public.hunterQueue = [];
  draft.public.resumePhase = null;
  setPhase(draft, "GAME_OVER", null, 0);
}

function startNight(draft: ClassicGameState, now: number) {
  const pub = draft.public;
  pub.nightNumber += 1;
  // Fixed queue from the configured composition, so pacing never reveals who is dead.
  pub.nightQueue = NIGHT_ORDER.filter((role) => turnConfigured(draft.settings, role) && (pub.nightNumber === 1 || !FIRST_NIGHT_ONLY.includes(role)));
  // The silence cast last night ended with the day.
  pub.silencedId = null;
  pub.nightTurnIndex = 0;
  pub.readyPlayerIds = [];
  draft.secret.night = emptyNight();
  setPhase(draft, "NIGHT_INTRO", PHASE_SECONDS.nightIntro, now);
}

function nextNightTurn(draft: ClassicGameState, now: number) {
  const pub = draft.public;
  if (pub.phase === "NIGHT_TURN") pub.nightTurnIndex += 1;
  else pub.nightTurnIndex = 0;
  draft.secret.night.actedPlayerIds = [];
  if (pub.nightTurnIndex < pub.nightQueue.length) {
    setPhase(draft, "NIGHT_TURN", draft.settings.nightTurnSeconds, now);
    return;
  }
  resolveDawn(draft);
  afterDeaths(draft, now, "DAY_DISCUSSION");
}

function enterPhase(draft: ClassicGameState, phase: "DAY_DISCUSSION" | "NIGHT_INTRO" | "OPEN_VOTING", now: number) {
  if (phase === "NIGHT_INTRO") {
    startNight(draft, now);
    return;
  }
  if (phase === "OPEN_VOTING") {
    startVoting(draft, now, false);
    return;
  }
  draft.public.dayNumber = draft.public.nightNumber;
  draft.public.skipDiscussionIds = [];
  setPhase(draft, "DAY_DISCUSSION", draft.settings.dayDiscussionSeconds, now);
}

/** Hunter shots resolve before the win check, because a shot can change the outcome. */
function afterDeaths(draft: ClassicGameState, now: number, resume: "DAY_DISCUSSION" | "NIGHT_INTRO" | "OPEN_VOTING") {
  const pub = draft.public;
  if (pub.hunterQueue.length > 0) {
    pub.resumePhase = resume;
    setPhase(draft, "HUNTER_REVENGE", PHASE_SECONDS.hunterRevenge, now);
    return;
  }
  const winner = evaluateWinner(draft);
  if (winner) {
    endGame(draft, winner);
    return;
  }
  pub.resumePhase = null;
  enterPhase(draft, resume, now);
}

function startVoting(draft: ClassicGameState, now: number, revote: boolean) {
  const pub = draft.public;
  draft.secret.votes = {};
  pub.votedPlayerIds = [];
  if (!revote) {
    pub.tiedPlayerIds = [];
    // Strike 1 removes the vote for this day's voting (including a revote).
    for (const player of pub.players) player.canVote = player.alive && !player.hasAfkPenalty;
  }
  setPhase(draft, revote ? "TIE_REVOTE" : "OPEN_VOTING", revote ? PHASE_SECONDS.tieRevote : PHASE_SECONDS.voting, now);
}

function eligibleVoters(state: ClassicGameState) {
  return state.public.players.filter((player) => player.alive && player.canVote);
}

function finishDayVoting(draft: ClassicGameState) {
  // A served vote ban ends with the day's voting.
  for (const player of draft.public.players) {
    if (!player.canVote && player.hasAfkPenalty) player.hasAfkPenalty = false;
    player.canVote = true;
  }
  draft.public.tiedPlayerIds = [];
}

function resolveVoting(draft: ClassicGameState, now: number) {
  const pub = draft.public;
  const revote = pub.phase === "TIE_REVOTE";
  const { records, leaders } = tallyVotes(draft);
  pub.lastVoteReveal = records;
  pub.votedPlayerIds = [];
  draft.secret.votes = {};
  if (leaders.length > 1 && !revote) {
    pub.tiedPlayerIds = leaders;
    setPhase(draft, "TIE_DEFENSE", PHASE_SECONDS.tieDefense, now);
    return;
  }
  finishDayVoting(draft);
  const executedId = leaders.length === 1 ? leaders[0]! : null;
  pub.log.push({ type: "EXECUTION", day: pub.dayNumber, playerId: executedId, votes: records });
  if (executedId && draft.secret.roles[executedId] === "TANNER") {
    applyDeaths(draft, [{ playerId: executedId, reason: "EXECUTION" }]);
    endGame(draft, { faction: "TANNER", playerIds: [executedId] });
    return;
  }
  // The Vampire's bitten players fall right after the vote; a Prince is spared once, whichever way he is sentenced.
  const doomed = pub.doomedIds.filter((id) => isAlive(draft, id) && id !== executedId);
  pub.doomedIds = [];
  for (const id of [...(executedId ? [executedId] : []), ...doomed]) {
    if (draft.secret.roles[id] === "PRINCE" && !pub.revealedPrinceIds.includes(id)) {
      pub.revealedPrinceIds.push(id);
      pub.log.push({ type: "PRINCE", day: pub.dayNumber, playerId: id });
      continue;
    }
    applyDeaths(draft, [{ playerId: id, reason: "EXECUTION" }]);
  }
  // The Troublemaker's second vote is played before night falls, unless the game ends first.
  const resume = pub.secondVoteQueued ? "OPEN_VOTING" : "NIGHT_INTRO";
  pub.secondVoteQueued = false;
  afterDeaths(draft, now, resume);
}

/** AFK strike: strike 1 sets the penalty, strike 2 eliminates without using the day's execution. */
function strikeAfk(draft: ClassicGameState, playerId: string): Death[] {
  const player = draft.public.players.find((item) => item.id === playerId)!;
  if (!player.hasAfkPenalty) {
    player.hasAfkPenalty = true;
    return [];
  }
  const deaths = applyDeaths(draft, [{ playerId, reason: "DEAD_AFK" }]);
  draft.public.log.push({ type: "AFK_ELIM", playerId, deaths });
  return deaths;
}

function holdersOf(state: ClassicGameState, role: NightRole) {
  const roles = turnRoles(role);
  return alivePlayers(state).filter((player) => roles.includes(state.secret.roles[player.id]!));
}

function promoteReplacement(draft: ClassicGameState, afkId: string, role: NightRole, ctx: ClassicContext, excluded: Set<string>) {
  const online = ctx.onlinePlayerIds ? new Set(ctx.onlinePlayerIds) : null;
  const candidates = alivePlayers(draft).filter((player) => draft.secret.roles[player.id] === "VILLAGER" && !player.hasAfkPenalty && !excluded.has(player.id) && (!online || online.has(player.id)));
  if (candidates.length === 0) return;
  const chosen = candidates[Math.floor((ctx.random ?? Math.random)() * candidates.length)]!;
  draft.secret.roles[chosen.id] = role;
  draft.secret.roles[afkId] = "VILLAGER";
  excluded.add(chosen.id);
  draft.secret.notices.push({ playerId: chosen.id, message: `Peranmu telah diperbarui menjadi ${CLASSIC_ROLE_INFO[role].name} karena pemain sebelumnya tidak aktif.` });
  draft.public.log.push({ type: "AFK_PROMOTION", night: draft.public.nightNumber, role });
}

function forceAdvance(draft: ClassicGameState, ctx: ClassicContext) {
  const pub = draft.public;
  switch (pub.phase) {
    case "ROLE_REVEAL": startNight(draft, ctx.now); return;
    case "NIGHT_INTRO": nextNightTurn(draft, ctx.now); return;
    case "NIGHT_TURN": {
      const role = activeNightRole(draft)!;
      // Only strike holders who could act: Mason's turn is information only, diseased Werewolves
      // cannot hunt, and a Witch with both potions spent has nothing to do.
      const canAct = role !== "MASON"
        && !(role === "APPRENTICE_SEER" && seerAlive(draft))
        && !(role === "WEREWOLF" && draft.secret.werewolvesDiseased)
        && !(role === "WITCH" && draft.secret.witchHealUsed && draft.secret.witchPoisonUsed);
      if (canAct) {
        const acted = new Set(draft.secret.night.actedPlayerIds);
        const afk = holdersOf(draft, role).filter((player) => !acted.has(player.id)).map((player) => player.id);
        const excluded = new Set(afk);
        for (const playerId of afk) {
          const deaths = strikeAfk(draft, playerId);
          if (deaths.length === 0) promoteReplacement(draft, playerId, role, ctx, excluded);
        }
        const winner = evaluateWinner(draft);
        if (winner && pub.hunterQueue.length === 0) { endGame(draft, winner); return; }
      }
      nextNightTurn(draft, ctx.now);
      return;
    }
    case "HUNTER_REVENGE": skipHunter(draft, ctx.now); return;
    case "DAY_DISCUSSION": startVoting(draft, ctx.now, false); return;
    case "TIE_DEFENSE": startVoting(draft, ctx.now, true); return;
    case "OPEN_VOTING":
    case "TIE_REVOTE": {
      const voted = new Set(pub.votedPlayerIds);
      for (const player of eligibleVoters(draft).filter((item) => !voted.has(item.id))) strikeAfk(draft, player.id);
      resolveVoting(draft, ctx.now);
      return;
    }
    case "GAME_OVER": fail("Permainan sudah selesai.");
  }
}

function skipHunter(draft: ClassicGameState, now: number) {
  const hunterId = draft.public.hunterQueue.shift();
  if (hunterId) draft.public.log.push({ type: "HUNTER", hunterId, targetId: null, deaths: [] });
  afterDeaths(draft, now, draft.public.resumePhase ?? "DAY_DISCUSSION");
}

// ---------- player actions ----------

function requireLivingTarget(state: ClassicGameState, targetId: string | undefined, actorId: string, allowSelf: boolean) {
  if (!targetId || !isAlive(state, targetId)) fail("Target harus pemain yang masih hidup.");
  if (!allowSelf && targetId === actorId) fail("Kamu tidak dapat memilih dirimu sendiri.");
  return targetId!;
}

function requireNightTurn(state: ClassicGameState, turn: NightRole, actorId: string) {
  if (activeNightRole(state) !== turn) fail("Bukan giliran role ini.");
  if (!isAlive(state, actorId)) fail("Pemain yang tereliminasi tidak dapat beraksi.");
  if (!turnRoles(turn).includes(state.secret.roles[actorId]!)) fail("Role kamu tidak dapat melakukan aksi ini.");
}

export function applyClassicAction(state: ClassicGameState, actor: Actor, action: ClassicAction, ctx: ClassicContext): ClassicGameState {
  const draft = structuredClone(state);
  const pub = draft.public;
  const secret = draft.secret;
  const player = pub.players.find((item) => item.id === actor.playerId);
  if (!player) fail("Kamu tidak memiliki kursi di permainan ini.");
  if (pub.phase === "GAME_OVER") fail("Permainan sudah selesai.");
  const markActed = () => {
    if (!secret.night.actedPlayerIds.includes(actor.playerId)) secret.night.actedPlayerIds.push(actor.playerId);
  };

  switch (action.type) {
    case "ready": {
      if (pub.phase !== "ROLE_REVEAL") fail("Fase pembagian role sudah selesai.");
      if (pub.readyPlayerIds.includes(actor.playerId)) fail("Kamu sudah siap.");
      pub.readyPlayerIds.push(actor.playerId);
      if (alivePlayers(draft).every((item) => pub.readyPlayerIds.includes(item.id))) startNight(draft, ctx.now);
      break;
    }
    case "wolf-target": {
      requireNightTurn(draft, "WEREWOLF", actor.playerId);
      if (secret.werewolvesDiseased) fail("Kawanan Werewolf sedang tertular penyakit dan tidak dapat berburu malam ini.");
      if (action.targetId !== null) {
        const target = requireLivingTarget(draft, action.targetId, actor.playerId, false);
        if (isPackRole(secret.roles[target]!)) fail("Werewolf tidak dapat memangsa sesama Werewolf.");
      }
      if (action.secondTargetId) {
        if (!isDoubleAttackNight(draft)) fail("Kawanan hanya boleh memilih dua korban setelah Wolf Cub gugur.");
        const second = requireLivingTarget(draft, action.secondTargetId, actor.playerId, false);
        if (isPackRole(secret.roles[second]!)) fail("Werewolf tidak dapat memangsa sesama Werewolf.");
        if (second === action.targetId) fail("Pilih dua korban yang berbeda.");
      }
      if (action.convert) {
        if (secret.roles[actor.playerId] !== "ALPHA_WOLF") fail("Hanya Alpha Wolf yang dapat mengubah korban.");
        if (secret.alphaUsed) fail("Alpha Wolf sudah memakai kemampuan mengubahnya.");
      }
      secret.night.wolfTargets[actor.playerId] = action.targetId;
      if (isDoubleAttackNight(draft)) secret.night.wolfSecondTargets[actor.playerId] = action.secondTargetId ?? null;
      if (secret.roles[actor.playerId] === "ALPHA_WOLF") secret.night.alphaConvert = Boolean(action.convert);
      markActed();
      break;
    }
    case "night-action": {
      const night = secret.night;
      switch (action.actionType) {
        case "DOCTOR_PROTECT": {
          requireNightTurn(draft, "DOCTOR", actor.playerId);
          const target = requireLivingTarget(draft, action.targetId, actor.playerId, true);
          if (target === secret.doctorLastTarget) fail("Guardian Angel tidak boleh melindungi pemain yang sama dua malam berturut-turut.");
          night.doctorTarget = target;
          break;
        }
        case "SEER_INSPECT": {
          const turn = activeNightRole(draft);
          if (turn !== "SEER" && turn !== "APPRENTICE_SEER") fail("Bukan giliran role ini.");
          requireNightTurn(draft, turn, actor.playerId);
          if (turn === "APPRENTICE_SEER" && seerAlive(draft)) fail("Seer masih hidup; Apprentice Seer belum dapat menerawang.");
          if (night.seerTarget) fail("Seer sudah menerawang malam ini.");
          const target = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          night.seerTarget = target;
          secret.seerResults.push({ seerId: actor.playerId, night: pub.nightNumber, targetId: target, appearsAs: appearsAsWerewolf(secret.roles[target]!) ? "WEREWOLF" : "VILLAGER" });
          break;
        }
        case "SORCERER_INSPECT": {
          requireNightTurn(draft, "SORCERER", actor.playerId);
          if (night.sorcererTarget) fail("Sorcerer sudah menerawang malam ini.");
          const target = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          night.sorcererTarget = target;
          const found = secret.roles[target] === "SEER" || secret.roles[target] === "APPRENTICE_SEER";
          secret.sorcererResults.push({ sorcererId: actor.playerId, night: pub.nightNumber, targetId: target, isSeer: found });
          break;
        }
        case "SPELLCASTER_SILENCE": {
          requireNightTurn(draft, "SPELLCASTER", actor.playerId);
          night.silenceTarget = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          break;
        }
        case "VAMPIRE_BITE": {
          requireNightTurn(draft, "VAMPIRE", actor.playerId);
          night.biteTarget = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          break;
        }
        case "DIRE_PARTNER": {
          requireNightTurn(draft, "DIRE_WOLF", actor.playerId);
          if (secret.direBond) fail("Dire Wolf sudah memilih rekan rahasia.");
          const partner = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          night.direTarget = partner;
          secret.direBond = { direId: actor.playerId, partnerId: partner };
          break;
        }
        case "WITCH_HEAL": {
          requireNightTurn(draft, "WITCH", actor.playerId);
          if (secret.witchHealUsed) fail("Ramuan Penyelamat sudah dipakai.");
          if (!currentWolfVictim(draft)) fail("Tidak ada korban yang dapat diselamatkan malam ini.");
          night.witchHeal = true;
          secret.witchHealUsed = true;
          break;
        }
        case "WITCH_POISON": {
          requireNightTurn(draft, "WITCH", actor.playerId);
          if (secret.witchPoisonUsed) fail("Ramuan Racun sudah dipakai.");
          night.witchPoisonTarget = requireLivingTarget(draft, action.targetId, actor.playerId, false);
          secret.witchPoisonUsed = true;
          break;
        }
        case "SKIP": {
          const role = activeNightRole(draft);
          if (!role || role === "MASON") fail("Tidak ada aksi malam yang dapat dilewati.");
          requireNightTurn(draft, role, actor.playerId);
          break;
        }
        case "CUPID_LINK": {
          requireNightTurn(draft, "CUPID", actor.playerId);
          const first = requireLivingTarget(draft, action.targetId, actor.playerId, true);
          const second = requireLivingTarget(draft, action.secondaryTargetId, actor.playerId, true);
          if (first === second) fail("Pilih dua pemain yang berbeda.");
          night.cupidLink = [first, second];
          secret.lovers = [first, second];
          break;
        }
      }
      markActed();
      break;
    }
    case "skip-discussion": {
      if (pub.phase !== "DAY_DISCUSSION") fail("Diskusi tidak sedang berlangsung.");
      if (!player!.alive) fail("Pemain yang tereliminasi tidak dapat memilih.");
      if (!pub.skipDiscussionIds.includes(actor.playerId)) pub.skipDiscussionIds.push(actor.playerId);
      markActed();
      if (pub.skipDiscussionIds.filter((id) => isAlive(draft, id)).length * 2 > alivePlayers(draft).length) startVoting(draft, ctx.now, false);
      break;
    }
    case "vote": {
      if (pub.phase !== "OPEN_VOTING" && pub.phase !== "TIE_REVOTE") fail("Voting tidak sedang berlangsung.");
      if (!player!.alive) fail("Pemain yang tereliminasi tidak dapat memilih.");
      if (!player!.canVote) fail("Hak voting kamu dicabut untuk putaran ini karena AFK.");
      if (action.targetId !== null) {
        const target = requireLivingTarget(draft, action.targetId, actor.playerId, false);
        if (pub.phase === "TIE_REVOTE" && !pub.tiedPlayerIds.includes(target)) fail("Voting ulang hanya untuk kandidat yang seri.");
      }
      secret.votes[actor.playerId] = action.targetId;
      if (!pub.votedPlayerIds.includes(actor.playerId)) pub.votedPlayerIds.push(actor.playerId);
      markActed();
      if (eligibleVoters(draft).every((item) => pub.votedPlayerIds.includes(item.id))) resolveVoting(draft, ctx.now);
      break;
    }
    case "hunter-shot": {
      if (pub.phase !== "HUNTER_REVENGE" || pub.hunterQueue[0] !== actor.playerId) fail("Bukan giliran Hunter menembak.");
      const target = requireLivingTarget(draft, action.targetId, actor.playerId, false);
      pub.hunterQueue.shift();
      const deaths = applyDeaths(draft, [{ playerId: target, reason: "HUNTER" }]);
      pub.log.push({ type: "HUNTER", hunterId: actor.playerId, targetId: target, deaths });
      afterDeaths(draft, ctx.now, pub.resumePhase ?? "DAY_DISCUSSION");
      break;
    }
    case "second-vote": {
      if (pub.phase !== "OPEN_VOTING") fail("Suara ganda hanya dapat dipakai saat voting pertama hari ini.");
      if (!player!.alive || secret.roles[actor.playerId] !== "TROUBLEMAKER") fail("Hanya Troublemaker yang masih hidup yang dapat memakai suara ganda.");
      if (secret.troublemakerUsed) fail("Troublemaker sudah memakai suara gandanya.");
      secret.troublemakerUsed = true;
      pub.secondVoteQueued = true;
      break;
    }
    case "force-advance": {
      if (!actor.isHost) fail("Hanya host yang dapat memaksa lanjut.");
      forceAdvance(draft, ctx);
      break;
    }
  }
  return draft;
}

/** Server-time housekeeping. Returns null when no deadline has passed. */
export function advanceClassic(state: ClassicGameState, now: number): ClassicGameState | null {
  const deadline = state.public.phaseDeadlineAt ? Date.parse(state.public.phaseDeadlineAt) : Number.NaN;
  if (!Number.isFinite(deadline) || now < deadline) return null;
  const draft = structuredClone(state);
  switch (draft.public.phase) {
    case "NIGHT_INTRO":
    case "NIGHT_TURN": nextNightTurn(draft, now); break;
    case "HUNTER_REVENGE": skipHunter(draft, now); break;
    case "DAY_DISCUSSION": startVoting(draft, now, false); break;
    case "TIE_DEFENSE": startVoting(draft, now, true); break;
    case "OPEN_VOTING":
    case "TIE_REVOTE": resolveVoting(draft, now); break;
    default: return null;
  }
  return draft;
}
