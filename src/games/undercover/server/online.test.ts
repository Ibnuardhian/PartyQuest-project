import { describe, expect, it } from "vitest";
import { OnlineGameError, type StoredSession } from "@/games/online-game";
import type { PublicState, SecretState } from "@/games/undercover/contract";
import { undercoverOnline } from "@/games/undercover/server/online";

const members = [
  { userId: "11111111-1111-4111-8111-111111111111", displayName: "Alya" },
  { userId: "22222222-2222-4222-8222-222222222222", displayName: "Bima" },
  { userId: "33333333-3333-4333-8333-333333333333", displayName: "Citra" },
  { userId: "44444444-4444-4444-8444-444444444444", displayName: "Dewi" },
];
const outsider = "99999999-9999-4999-8999-999999999999";
const settings = { category: "makanan", undercoverCount: 1, mrWhiteEnabled: false };
const now = Date.UTC(2026, 10, 22, 12);
const ctx = (userId: string) => ({ userId, isHost: false, now, onlineUserIds: members.map((member) => member.userId) });

function newSession(): StoredSession {
  const round = undercoverOnline.createRound(members, settings);
  return { publicState: round.publicState, secretState: round.secretState, settings };
}

function expectGameError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(OnlineGameError);
    expect((error as OnlineGameError).status).toBe(status);
    expect((error as OnlineGameError).code).toBe(code);
    return;
  }
  throw new Error("expected OnlineGameError");
}

function revealAll(session: StoredSession) {
  let current = session;
  for (const member of members) current = { ...current, publicState: undercoverOnline.applyIntent(current, { type: "confirm-reveal" }, ctx(member.userId)).publicState };
  return current;
}

describe("Undercover Online Room adapter", () => {
  it("validates room settings", () => {
    expect(undercoverOnline.parseSettings(settings)).toEqual(settings);
    expectGameError(() => undercoverOnline.parseSettings({ ...settings, category: "senjata" }), 400, "invalid_input");
    expectGameError(() => undercoverOnline.parseSettings({ ...settings, extra: true }), 400, "invalid_input");
  });

  it("deals one private assignment per verified member", () => {
    const round = undercoverOnline.createRound(members, settings);
    expect(round.playerPrivate.map((item) => item.playerId).sort()).toEqual(members.map((member) => member.userId).sort());
    expect(round.publicState.players.map((player) => player.id)).toEqual(members.map((member) => member.userId));
    expect(JSON.stringify(round.publicState)).not.toContain((round.secretState as SecretState).civilianWord);
  });

  it("returns only the requesting player's word before the game ends", () => {
    const session = newSession();
    const secret = session.secretState as SecretState;
    for (const member of members) {
      const view = undercoverOnline.view(session, { userId: member.userId, isHost: false }) as { view: { private: { playerId: string; word: string | null }; result: unknown } };
      const own = secret.assignments.find((item) => item.playerId === member.userId)!;
      expect(view.view.private.playerId).toBe(member.userId);
      expect(view.view.result).toBeNull();
      const otherWords = secret.assignments.filter((item) => item.word && item.word !== own.word).map((item) => item.word!);
      for (const word of otherWords) expect(JSON.stringify(view)).not.toContain(word);
    }
    expect(undercoverOnline.view(session, { userId: outsider, isHost: false })).toBeNull();
  });

  it("binds actions to the server-verified user and rejects spoofed or unseated actors", () => {
    const session = newSession();
    expectGameError(() => undercoverOnline.applyIntent(session, { type: "confirm-reveal", playerId: members[1]!.userId }, ctx(members[0]!.userId)).publicState, 400, "invalid_input");
    expectGameError(() => undercoverOnline.applyIntent(session, { type: "confirm-reveal" }, ctx(outsider)).publicState, 403, "not_a_player");
    const next = undercoverOnline.applyIntent(session, { type: "confirm-reveal" }, ctx(members[1]!.userId)).publicState as PublicState;
    expect(next.revealedPlayerIds).toEqual([members[1]!.userId]);
  });

  it("rejects actions outside the current phase or turn", () => {
    const session = newSession();
    expectGameError(() => undercoverOnline.applyIntent(session, { type: "submit-clue" }, ctx(members[0]!.userId)).publicState, 400, "invalid_action");
    const clue = revealAll(session);
    expect((clue.publicState as PublicState).phase).toBe("clue");
    const active = (clue.publicState as PublicState).players.filter((player) => player.alive)[(clue.publicState as PublicState).clueIndex]!;
    const waiting = members.find((member) => member.userId !== active.id)!;
    expectGameError(() => undercoverOnline.applyIntent(clue, { type: "submit-clue" }, ctx(waiting.userId)).publicState, 400, "invalid_action");
  });

  it("advances clue deadlines from server time only", () => {
    const clue = revealAll(newSession());
    const publicState = clue.publicState as PublicState;
    expect(undercoverOnline.advance(clue, now)).toBeNull();
    const missing = undercoverOnline.advance({ ...clue, publicState: { ...publicState, clueDeadlineAt: null } }, now)!.publicState as unknown as PublicState;
    expect(Date.parse(missing.clueDeadlineAt!)).toBe(now + 180_000);
    const expired = undercoverOnline.advance(clue, Date.parse(publicState.clueDeadlineAt!) + 1)!.publicState as unknown as PublicState;
    expect(expired.clueIndex).toBe(1);
    expect(expired.clues).toHaveLength(1);
  });
});
