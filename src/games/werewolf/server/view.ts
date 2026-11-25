import { PACK_ROLES, type ClassicGameState, type ClassicPlayer, type ClassicRole, type LogEntry, type NightRole, type VoteRecord } from "@/games/werewolf/contract";
import { activeNightRole, turnRoles } from "@/games/werewolf/engine/classic/engine";
import { alignmentOf, currentWolfVictim, isDoubleAttackNight, isPackRole } from "@/games/werewolf/engine/classic/resolve";

/**
 * Per-player views for Werewolf Classic (docs/04 §6). Pure functions over server state.
 * Nothing here may expose a role, night pick, or hidden vote the viewer is not entitled to.
 */

/** Death causes reveal roles (poison = Witch, heartbreak = Lovers), so only public causes are shown. */
export type PublicDeath = "EXECUTION" | "HUNTER" | "DEAD_AFK" | "NIGHT";

function publicDeath(player: ClassicPlayer): PublicDeath | null {
  if (player.alive || !player.deathReason) return null;
  return player.deathReason === "EXECUTION" || player.deathReason === "HUNTER" || player.deathReason === "DEAD_AFK" ? player.deathReason : "NIGHT";
}

export type PublicLogEntry =
  | { type: "DAWN"; night: number; deadPlayerIds: string[] }
  | { type: "EXECUTION"; day: number; playerId: string | null; votes: VoteRecord[] }
  | { type: "HUNTER"; hunterId: string; targetId: string | null; deadPlayerIds: string[] }
  | { type: "AFK_ELIM"; playerId: string; deadPlayerIds: string[] }
  | { type: "PRINCE"; day: number; playerId: string };

function publicLog(log: LogEntry[]): PublicLogEntry[] {
  return log.flatMap((entry): PublicLogEntry[] => {
    switch (entry.type) {
      case "DAWN": return [{ type: "DAWN", night: entry.night, deadPlayerIds: entry.deaths.map((death) => death.playerId) }];
      case "EXECUTION": return [{ type: "EXECUTION", day: entry.day, playerId: entry.playerId, votes: entry.votes }];
      case "HUNTER": return [{ type: "HUNTER", hunterId: entry.hunterId, targetId: entry.targetId, deadPlayerIds: entry.deaths.map((death) => death.playerId) }];
      case "AFK_ELIM": return [{ type: "AFK_ELIM", playerId: entry.playerId, deadPlayerIds: entry.deaths.map((death) => death.playerId) }];
      // Which role was reassigned is secret.
      case "AFK_PROMOTION": return [];
      case "PRINCE": return [{ type: "PRINCE", day: entry.day, playerId: entry.playerId }];
    }
  });
}

/** Everything any player (or the TV) may see. */
export function buildPublicView(state: ClassicGameState) {
  const pub = state.public;
  const over = pub.phase === "GAME_OVER";
  return {
    phase: pub.phase,
    nightNumber: pub.nightNumber,
    dayNumber: pub.dayNumber,
    phaseDeadlineAt: pub.phaseDeadlineAt,
    nightQueue: pub.nightQueue,
    activeNightRole: activeNightRole(state),
    players: pub.players.map((player) => ({ id: player.id, name: player.name, alive: player.alive, death: publicDeath(player), canVote: player.canVote, hasAfkPenalty: player.hasAfkPenalty })),
    readyPlayerIds: pub.readyPlayerIds,
    skipDiscussionIds: pub.skipDiscussionIds,
    votedPlayerIds: pub.votedPlayerIds,
    tiedPlayerIds: pub.tiedPlayerIds,
    lastVoteReveal: pub.lastVoteReveal,
    hunterId: pub.phase === "HUNTER_REVENGE" ? pub.hunterQueue[0] ?? null : null,
    /** Public effects of the Phase 8 roles: today's silenced player, Vampire marks, revealed Princes, a queued second vote. */
    silencedId: pub.silencedId,
    doomedIds: pub.doomedIds,
    revealedPrinceIds: pub.revealedPrinceIds,
    secondVoteQueued: pub.secondVoteQueued,
    /** The configured role list is public, like a physical deck on the table. */
    composition: state.settings.roles,
    deadRevealMode: state.settings.deadRevealMode,
    nightTurnSeconds: state.settings.nightTurnSeconds,
    dayDiscussionSeconds: state.settings.dayDiscussionSeconds,
    log: publicLog(pub.log),
    winner: pub.winner,
    winReason: pub.winReason,
    finalRoles: over ? state.secret.roles : null,
    originalRoles: over ? state.secret.originalRoles : null,
    lovers: over ? state.secret.lovers : null,
  };
}

function masonsHaveMet(state: ClassicGameState) {
  const pub = state.public;
  if (pub.nightNumber > 1) return true;
  if (pub.nightNumber === 0) return false;
  if (pub.phase !== "NIGHT_INTRO" && pub.phase !== "NIGHT_TURN") return true;
  const masonIndex = pub.nightQueue.indexOf("MASON");
  return pub.phase === "NIGHT_TURN" && masonIndex >= 0 && pub.nightTurnIndex >= masonIndex;
}

/** Roles this viewer knows: own role, teammates, spectator reveal, or everything after the game. */
export function knownRolesFor(state: ClassicGameState, playerId: string): Record<string, ClassicRole> {
  const roles = state.secret.roles;
  const me = state.public.players.find((player) => player.id === playerId);
  const myRole = roles[playerId];
  if (!me || !myRole) return {};
  if (state.public.phase === "GAME_OVER" || (!me.alive && state.settings.deadRevealMode === "SPECTATOR_REVEAL")) return { ...roles };
  const known: Record<string, ClassicRole> = { [playerId]: myRole };
  const reveal = (role: ClassicRole) => {
    for (const [id, value] of Object.entries(roles)) if (value === role) known[id] = value;
  };
  // The pack knows itself (a sleeping Dream Wolf is listed for the others but knows no one); the Minion knows the pack.
  if ((isPackRole(myRole) && myRole !== "DREAM_WOLF") || myRole === "MINION") for (const packRole of PACK_ROLES) reveal(packRole);
  if (myRole === "MASON" && masonsHaveMet(state)) reveal("MASON");
  return known;
}

export function buildPlayerView(state: ClassicGameState, viewer: { userId: string; isHost: boolean }) {
  const me = state.public.players.find((player) => player.id === viewer.userId);
  if (!me) return null;
  const secret = state.secret;
  const role = secret.roles[viewer.userId]!;
  const turn: NightRole | null = activeNightRole(state);
  const myTurn = Boolean(me.alive && turn && turnRoles(turn).includes(role));
  const wolfTurn = myTurn && turn === "WEREWOLF";
  const lovers = secret.lovers;
  const knowsLovers = lovers && (lovers.includes(viewer.userId) || (role === "CUPID" && me.alive) || secret.originalRoles[viewer.userId] === "CUPID");

  return {
    public: buildPublicView(state),
    you: {
      playerId: viewer.userId,
      isHost: viewer.isHost,
      role,
      alignment: alignmentOf(role),
      alive: me.alive,
      canVote: me.canVote,
      isMyTurn: myTurn,
      ready: state.public.readyPlayerIds.includes(viewer.userId),
      myVote: viewer.userId in secret.votes ? secret.votes[viewer.userId] ?? null : undefined,
    },
    knownRoles: knownRolesFor(state, viewer.userId),
    lovers: knowsLovers ? lovers : null,
    /** Live picks of fellow alive Werewolves during their turn (claw markers). */
    wolfTargets: wolfTurn ? secret.night.wolfTargets : null,
    /** Second picks and the Alpha Wolf's conversion switch, only during the pack's own turn. */
    wolfSecondTargets: wolfTurn && isDoubleAttackNight(state) ? secret.night.wolfSecondTargets : null,
    doubleAttack: wolfTurn && isDoubleAttackNight(state),
    alpha: role === "ALPHA_WOLF" ? { available: !secret.alphaUsed, converting: secret.night.alphaConvert } : null,
    werewolvesDiseased: wolfTurn ? secret.werewolvesDiseased : null,
    seerResults: ["SEER", "APPRENTICE_SEER"].includes(role) || ["SEER", "APPRENTICE_SEER"].includes(secret.originalRoles[viewer.userId]!) ? secret.seerResults.filter((result) => result.seerId === viewer.userId) : [],
    /** The Apprentice Seer only reads once no Seer is alive. */
    seerAlive: role === "APPRENTICE_SEER" ? state.public.players.some((player) => player.alive && secret.roles[player.id] === "SEER") : null,
    sorcererResults: role === "SORCERER" ? secret.sorcererResults.filter((result) => result.sorcererId === viewer.userId) : [],
    direPartnerId: role === "DIRE_WOLF" && secret.direBond?.direId === viewer.userId ? secret.direBond.partnerId : null,
    troublemaker: role === "TROUBLEMAKER" ? { available: !secret.troublemakerUsed } : null,
    doctor: role === "DOCTOR" ? { lastTarget: secret.doctorLastTarget, tonight: myTurn ? secret.night.doctorTarget : null } : null,
    witch: role === "WITCH" ? {
      healAvailable: !secret.witchHealUsed,
      poisonAvailable: !secret.witchPoisonUsed,
      victimId: myTurn ? currentWolfVictim(state) : null,
    } : null,
    actedThisTurn: myTurn && secret.night.actedPlayerIds.includes(viewer.userId),
    notices: secret.notices.filter((notice) => notice.playerId === viewer.userId).map((notice) => notice.message),
  };
}
