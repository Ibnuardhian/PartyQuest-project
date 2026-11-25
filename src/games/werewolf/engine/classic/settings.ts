import { z } from "zod";
import { CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES, HUNTING_ROLES, PACK_ROLES, TWIST_ROLES, type ClassicRole, type ClassicSettings } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO, recommendedComposition } from "@/games/werewolf/roles";

const roleCountSchema = z.number().int().min(0).max(CLASSIC_MAX_PLAYERS);

export const classicSettingsSchema = z.object({
  roles: z.partialRecord(z.enum(CLASSIC_ROLES), roleCountSchema),
  deadRevealMode: z.enum(["SPECTATOR_REVEAL", "KEEP_HIDDEN"]),
  nightTurnSeconds: z.number().int().min(10).max(30),
  dayDiscussionSeconds: z.number().int().min(60).max(600),
  advanced: z.boolean().optional(),
}).strict();

export function defaultClassicSettings(playerCount: number): ClassicSettings {
  return { roles: recommendedComposition(playerCount), deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180, advanced: false };
}

export function countRoles(roles: Partial<Record<ClassicRole, number>>) {
  return CLASSIC_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
}

/** Names of twist roles used in a composition; they are only allowed in Advanced mode. */
export function twistRolesIn(roles: Partial<Record<ClassicRole, number>>): ClassicRole[] {
  return TWIST_ROLES.filter((role) => (roles[role] ?? 0) > 0);
}

export function twistRolesMessage(roles: Partial<Record<ClassicRole, number>>): string {
  return `Role bertwist (${twistRolesIn(roles).map((role) => CLASSIC_ROLE_INFO[role].name).join(", ")}) hanya tersedia di mode lanjutan.`;
}

/** Validates the Host's composition against the real player count. Throws with an Indonesian message. */
export function validateClassicSettings(input: unknown, playerCount: number): ClassicSettings {
  const parsed = classicSettingsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Pengaturan Werewolf tidak valid.");
  if (!Number.isInteger(playerCount) || playerCount < CLASSIC_MIN_PLAYERS || playerCount > CLASSIC_MAX_PLAYERS) {
    throw new Error(`Werewolf Classic memerlukan ${CLASSIC_MIN_PLAYERS}–${CLASSIC_MAX_PLAYERS} pemain.`);
  }
  const roles = Object.fromEntries(Object.entries(parsed.data.roles).filter(([, count]) => (count ?? 0) > 0)) as Partial<Record<ClassicRole, number>>;
  const advanced = parsed.data.advanced ?? false;
  if (!advanced && twistRolesIn(roles).length > 0) throw new Error(twistRolesMessage(roles));
  if (countRoles(roles) !== playerCount) throw new Error("Jumlah role harus sama dengan jumlah pemain.");
  for (const role of CLASSIC_ROLES) {
    const count = roles[role] ?? 0;
    const info = CLASSIC_ROLE_INFO[role];
    if (count > info.max) throw new Error(`${info.name} maksimal ${info.max}.`);
    if (count > 0 && count < info.minWhenPresent) throw new Error(`${info.name} minimal ${info.minWhenPresent} jika dipakai.`);
  }
  // The pack: Werewolves plus the wolf-side roles that count as Werewolves. At least one must wake and hunt.
  const hunters = HUNTING_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
  const werewolves = PACK_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
  if (hunters < 1) throw new Error("Minimal ada satu Werewolf yang bangun dan memangsa.");
  if (werewolves >= playerCount - werewolves) throw new Error("Werewolf harus lebih sedikit daripada pemain lain.");
  return { ...parsed.data, advanced, roles };
}
