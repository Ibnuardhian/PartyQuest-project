import { z } from "zod";
import { OnlineGameError, type OnlineGameServer, type StoredSession } from "@/games/online-game";
import {
  CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES,
  type ClassicAction, type ClassicGameState, type ClassicPublicState, type ClassicRole, type ClassicSecretState, type ClassicSettings,
} from "@/games/werewolf/contract";
import { advanceClassic, applyClassicAction, ClassicRuleError, createClassicGame } from "@/games/werewolf/engine/classic/engine";
import { classicSettingsSchema, countRoles, twistRolesIn, twistRolesMessage, validateClassicSettings } from "@/games/werewolf/engine/classic/settings";
import { CLASSIC_ROLE_INFO, recommendedAdvancedComposition, recommendedComposition } from "@/games/werewolf/roles";
import { buildPlayerView, buildPublicView } from "@/games/werewolf/server/view";

/** Werewolf Classic adapter for Online Room (docs/04). Pure: no database, no HTTP. */

/**
 * Room settings. `roles: "AUTO"` uses the recommended composition for the final player count;
 * a custom composition must match the player count when the host starts.
 */
export const werewolfRoomSettingsSchema = classicSettingsSchema.extend({
  roles: z.union([z.literal("AUTO"), classicSettingsSchema.shape.roles]),
}).strict();
export type WerewolfRoomSettings = z.infer<typeof werewolfRoomSettingsSchema>;

/** The shortest discussion: the "one minute left" warning would otherwise collide with the dawn narration. */
const MIN_DISCUSSION_SECONDS = 180;

export const DEFAULT_ROOM_SETTINGS: WerewolfRoomSettings = { roles: "AUTO", deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180, advanced: false };

const playerId = z.string().uuid();
export const werewolfIntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }).strict(),
  z.object({ type: z.literal("wolf-target"), targetId: playerId.nullable(), secondTargetId: playerId.nullable().optional(), convert: z.boolean().optional() }).strict(),
  z.object({
    type: z.literal("night-action"),
    actionType: z.enum(["DOCTOR_PROTECT", "SEER_INSPECT", "WITCH_HEAL", "WITCH_POISON", "CUPID_LINK", "SORCERER_INSPECT", "SPELLCASTER_SILENCE", "VAMPIRE_BITE", "DIRE_PARTNER", "SKIP"]),
    targetId: playerId.optional(),
    secondaryTargetId: playerId.optional(),
  }).strict(),
  z.object({ type: z.literal("skip-discussion") }).strict(),
  z.object({ type: z.literal("vote"), targetId: playerId.nullable() }).strict(),
  z.object({ type: z.literal("hunter-shot"), targetId: playerId }).strict(),
  z.object({ type: z.literal("second-vote") }).strict(),
  z.object({ type: z.literal("force-advance") }).strict(),
]);

/** Many players act at once on these; a stale version should not drop a valid pick. */
const COMMUTATIVE = new Set(["ready", "wolf-target", "night-action", "skip-discussion", "vote"]);

/** Secret blob stored in game_private_state: engine secrets plus the resolved settings for this round. */
interface StoredSecret { secret: ClassicSecretState; settings: ClassicSettings }

export function restoreClassic(session: StoredSession): ClassicGameState {
  const stored = session.secretState as StoredSecret;
  return { public: session.publicState as ClassicPublicState, secret: stored.secret, settings: stored.settings };
}

function persist(state: ClassicGameState) {
  return { publicState: state.public, secretState: { secret: state.secret, settings: state.settings } satisfies StoredSecret };
}

function invalidSettings(message: string): never {
  throw new OnlineGameError(400, "invalid_input", message);
}

export function resolveClassicSettings(room: WerewolfRoomSettings, playerCount: number): ClassicSettings {
  const roles = room.roles === "AUTO" ? (room.advanced ? recommendedAdvancedComposition(playerCount) : recommendedComposition(playerCount)) : room.roles;
  return validateClassicSettings({ ...room, roles }, playerCount);
}

export const werewolfOnline: OnlineGameServer = {
  key: "werewolf",
  minPlayers: CLASSIC_MIN_PLAYERS,
  maxPlayers: CLASSIC_MAX_PLAYERS,
  defaultSettings: () => DEFAULT_ROOM_SETTINGS,
  hostCanRenameMembers: true,
  parseSettings(input) {
    const parsed = werewolfRoomSettingsSchema.safeParse(input);
    if (!parsed.success) invalidSettings("Pengaturan Werewolf tidak valid.");
    const settings = parsed.data;
    if (settings.roles !== "AUTO") {
      // Shape checks that do not depend on the final player count.
      const roles = settings.roles;
      const total = countRoles(roles);
      if (total < CLASSIC_MIN_PLAYERS || total > CLASSIC_MAX_PLAYERS) invalidSettings(`Komposisi harus berisi ${CLASSIC_MIN_PLAYERS}–${CLASSIC_MAX_PLAYERS} role.`);
      if ((roles.WEREWOLF ?? 0) < 1) invalidSettings("Minimal ada satu Werewolf.");
      if (!settings.advanced && twistRolesIn(roles).length > 0) invalidSettings(twistRolesMessage(roles));
      for (const role of CLASSIC_ROLES) {
        const count = roles[role as ClassicRole] ?? 0;
        if (count > CLASSIC_ROLE_INFO[role].max) invalidSettings(`${CLASSIC_ROLE_INFO[role].name} maksimal ${CLASSIC_ROLE_INFO[role].max}.`);
      }
    }
    return settings;
  },
  createRound(members, rawSettings) {
    // Rooms saved before the 3-minute minimum may still hold a shorter discussion: raise it instead of refusing to start.
    const stored = rawSettings && typeof rawSettings === "object" ? rawSettings as Record<string, unknown> : {};
    const room = werewolfRoomSettingsSchema.safeParse(typeof stored.dayDiscussionSeconds === "number" && stored.dayDiscussionSeconds < MIN_DISCUSSION_SECONDS ? { ...stored, dayDiscussionSeconds: MIN_DISCUSSION_SECONDS } : rawSettings);
    if (!room.success) throw new OnlineGameError(409, "invalid_settings", "Pengaturan Werewolf tidak valid.");
    let state: ClassicGameState;
    try {
      const settings = resolveClassicSettings(room.data, members.length);
      state = createClassicGame(members.map((member) => ({ id: member.userId, name: member.displayName })), settings, { now: Date.now() });
    } catch (cause) {
      throw new OnlineGameError(409, "invalid_settings", cause instanceof Error ? cause.message : "Komposisi role tidak sesuai jumlah pemain.");
    }
    return { ...persist(state), playerPrivate: members.map((member) => ({ playerId: member.userId, role: state.secret.roles[member.userId] })) };
  },
  applyIntent(session, rawIntent, ctx) {
    const intent = werewolfIntentSchema.safeParse(rawIntent);
    if (!intent.success) throw new OnlineGameError(400, "invalid_input", "Aksi permainan tidak valid.");
    const state = restoreClassic(session);
    if (!state.public.players.some((player) => player.id === ctx.userId)) throw new OnlineGameError(403, "not_a_player", "Kamu tidak memiliki kursi di permainan ini.");
    try {
      const next = applyClassicAction(state, { playerId: ctx.userId, isHost: ctx.isHost }, intent.data as ClassicAction, { now: ctx.now, onlinePlayerIds: ctx.onlineUserIds });
      return persist(next);
    } catch (cause) {
      if (cause instanceof ClassicRuleError) throw new OnlineGameError(400, "invalid_action", cause.message);
      throw cause;
    }
  },
  retryOnConflict(intent) {
    return typeof intent === "object" && intent !== null && COMMUTATIVE.has(String((intent as { type?: unknown }).type));
  },
  advance(session, now) {
    const next = advanceClassic(restoreClassic(session), now);
    return next ? persist(next) : null;
  },
  view(session, viewer) {
    return buildPlayerView(restoreClassic(session), viewer);
  },
  publicView(session) {
    return buildPublicView(restoreClassic(session));
  },
};
