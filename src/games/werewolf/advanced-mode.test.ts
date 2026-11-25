import { describe, expect, it } from "vitest";
import { BASE_ROLES, CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, CLASSIC_ROLES, TWIST_ROLES, type ClassicRole } from "@/games/werewolf/contract";
import { countRoles, validateClassicSettings } from "@/games/werewolf/engine/classic/settings";
import { CLASSIC_ROLE_INFO, isTwistRole, recommendedAdvancedComposition, recommendedComposition } from "@/games/werewolf/roles";
import { DEFAULT_ROOM_SETTINGS, resolveClassicSettings, werewolfOnline } from "@/games/werewolf/server/online";

const counts = Array.from({ length: CLASSIC_MAX_PLAYERS - CLASSIC_MIN_PLAYERS + 1 }, (_, index) => CLASSIC_MIN_PLAYERS + index);
const twistIn = (roles: Partial<Record<ClassicRole, number>>) => TWIST_ROLES.filter((role) => (roles[role] ?? 0) > 0);

describe("Advanced mode roles", () => {
  it("keeps the twist flag, TWIST_ROLES, and BASE_ROLES consistent", () => {
    for (const role of CLASSIC_ROLES) {
      expect(CLASSIC_ROLE_INFO[role].twist, role).toBe(TWIST_ROLES.includes(role));
      expect(isTwistRole(role), role).toBe(CLASSIC_ROLE_INFO[role].twist);
    }
    expect([...BASE_ROLES, ...TWIST_ROLES].sort()).toEqual([...CLASSIC_ROLES].sort());
  });

  it("the basic composition never contains a twist role", () => {
    for (const players of counts) {
      const roles = recommendedComposition(players);
      expect(twistIn(roles), `${players} players`).toEqual([]);
      expect(countRoles(roles)).toBe(players);
    }
  });

  it("the advanced composition adds twist roles, fills every seat, and stays valid", () => {
    for (const players of counts) {
      const roles = recommendedAdvancedComposition(players);
      expect(countRoles(roles), `${players} players`).toBe(players);
      expect(twistIn(roles).length, `${players} players`).toBeGreaterThanOrEqual(1);
      expect(roles.VILLAGER ?? 0, `${players} players`).toBeGreaterThanOrEqual(1);
      expect(() => validateClassicSettings({ ...DEFAULT_ROOM_SETTINGS, roles, advanced: true }, players), `${players} players`).not.toThrow();
    }
  });

  it("brings in more twist roles as the table grows", () => {
    expect(twistIn(recommendedAdvancedComposition(16)).length).toBeGreaterThan(twistIn(recommendedAdvancedComposition(5)).length);
    // The most readable twist roles come first.
    expect(twistIn(recommendedAdvancedComposition(5))).toEqual(["WITCH"]);
  });
});

describe("Advanced mode room settings", () => {
  const withTwist = { ...DEFAULT_ROOM_SETTINGS, roles: { WEREWOLF: 1, SEER: 1, WITCH: 1, VILLAGER: 2 } };

  it("is off by default and rejects twist roles until it is switched on", () => {
    expect(DEFAULT_ROOM_SETTINGS.advanced).toBe(false);
    expect(() => werewolfOnline.parseSettings(withTwist)).toThrow(/mode lanjutan/);
    expect(() => validateClassicSettings(withTwist, 5)).toThrow(/mode lanjutan/);
    expect(werewolfOnline.parseSettings({ ...withTwist, advanced: true })).toMatchObject({ advanced: true, roles: { WITCH: 1 } });
  });

  it("treats settings saved before Advanced mode existed as basic mode", () => {
    const { advanced, ...legacy } = DEFAULT_ROOM_SETTINGS;
    void advanced;
    expect(werewolfOnline.parseSettings(legacy)).toMatchObject({ roles: "AUTO" });
    expect(resolveClassicSettings(legacy, 8).advanced).toBe(false);
  });

  it("uses the advanced composition for AUTO only when switched on", () => {
    expect(twistIn(resolveClassicSettings(DEFAULT_ROOM_SETTINGS, 10).roles)).toEqual([]);
    const advanced = resolveClassicSettings({ ...DEFAULT_ROOM_SETTINGS, advanced: true }, 10);
    expect(advanced.advanced).toBe(true);
    expect(twistIn(advanced.roles).length).toBeGreaterThanOrEqual(1);
  });

  it("starts a round with twist roles in an advanced room", () => {
    const members = Array.from({ length: 9 }, (_, index) => ({ userId: `00000000-0000-4000-8000-00000000000${index + 1}`, displayName: `Pemain ${index + 1}` }));
    const round = werewolfOnline.createRound(members, { ...DEFAULT_ROOM_SETTINGS, advanced: true });
    const assigned = round.playerPrivate.map((item) => (item as unknown as { role: ClassicRole }).role);
    expect(assigned.filter((role) => TWIST_ROLES.includes(role)).length).toBeGreaterThanOrEqual(1);
  });
});
