import { z } from "zod";
import { CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES, type ClassicRole, type ClassicSettings } from "@/games/werewolf/contract";
import { CLASSIC_ROLE_INFO, recommendedComposition } from "@/games/werewolf/roles";

const roleCountSchema = z.number().int().min(0).max(CLASSIC_MAX_PLAYERS);

export const classicSettingsSchema = z.object({
  roles: z.partialRecord(z.enum(CLASSIC_ROLES), roleCountSchema),
  deadRevealMode: z.enum(["SPECTATOR_REVEAL", "KEEP_HIDDEN"]),
  nightTurnSeconds: z.number().int().min(10).max(30),
  dayDiscussionSeconds: z.number().int().min(60).max(600),
}).strict();

export function defaultClassicSettings(playerCount: number): ClassicSettings {
  return { roles: recommendedComposition(playerCount), deadRevealMode: "KEEP_HIDDEN", nightTurnSeconds: 15, dayDiscussionSeconds: 180 };
}

export function countRoles(roles: Partial<Record<ClassicRole, number>>) {
  return CLASSIC_ROLES.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
}

/** Validates the Host's composition against the real player count. Throws with an Indonesian message. */
export function validateClassicSettings(input: unknown, playerCount: number): ClassicSettings {
  const parsed = classicSettingsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Pengaturan Werewolf tidak valid.");
  if (!Number.isInteger(playerCount) || playerCount < CLASSIC_MIN_PLAYERS || playerCount > CLASSIC_MAX_PLAYERS) {
    throw new Error(`Werewolf Classic memerlukan ${CLASSIC_MIN_PLAYERS}–${CLASSIC_MAX_PLAYERS} pemain.`);
  }
  const roles = Object.fromEntries(Object.entries(parsed.data.roles).filter(([, count]) => (count ?? 0) > 0)) as Partial<Record<ClassicRole, number>>;
  if (countRoles(roles) !== playerCount) throw new Error("Jumlah role harus sama dengan jumlah pemain.");
  for (const role of CLASSIC_ROLES) {
    const count = roles[role] ?? 0;
    const info = CLASSIC_ROLE_INFO[role];
    if (count > info.max) throw new Error(`${info.name} maksimal ${info.max}.`);
    if (count > 0 && count < info.minWhenPresent) throw new Error(`${info.name} minimal ${info.minWhenPresent} jika dipakai.`);
  }
  const werewolves = roles.WEREWOLF ?? 0;
  if (werewolves < 1) throw new Error("Minimal ada satu Werewolf.");
  if (werewolves >= playerCount - werewolves) throw new Error("Werewolf harus lebih sedikit daripada pemain lain.");
  return { ...parsed.data, roles };
}
