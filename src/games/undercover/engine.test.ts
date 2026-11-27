import { describe, expect, it } from "vitest";
import { CLUE_MINUTES_OPTIONS, cluePassesForRound, type GameAction, type GameSettings, type GameState } from "@/games/undercover/contract";
import { confirmOfflineElimination, endClueWindow, finishOfflineClueRound, undercoverGame } from "@/games/undercover/engine";
import { parseLocalGameState } from "@/games/undercover/local-session";

const settings: GameSettings = { category: "makanan", undercoverCount: 1, mrWhiteEnabled: false };
const sequence = (...values: number[]) => { let index = 0; return (max: number) => (values[index++] ?? 0) % max; };
const start = (options: Partial<GameSettings> = {}, names = ["Alya", "Bima", "Citra"]) => undercoverGame.createInitialState(names, { ...settings, ...options }, sequence(0));
const run = (state: GameState, action: GameAction, now?: number) => undercoverGame.applyAction(state, action, now);

function revealAll(state: GameState): GameState {
  while (state.public.phase === "reveal") {
    const playerId = state.public.players.find((player) => !state.public.revealedPlayerIds.includes(player.id))!.id;
    state = run(state, { type: "confirm-reveal", playerId });
  }
  return state;
}

function cluesAndVoting(state: GameState): GameState {
  state = revealAll(state);
  while (state.public.phase === "clue") {
    state = endClueWindow(state, 0);
  }
  return state;
}

function voteFor(state: GameState, target: string, voters = state.public.players.filter((player) => player.alive).map((player) => player.id)): GameState {
  for (const playerId of voters) {
    if (state.public.phase !== "voting" && state.public.phase !== "revote") break;
    const destination = playerId === target ? state.public.players.find((player) => player.alive && player.id !== playerId)!.id : target;
    state = run(state, { type: "cast-vote", playerId, targetPlayerId: destination });
  }
  return state;
}

describe("Undercover engine", () => {
  it("validates player counts, distinct names, and a civilian majority", () => {
    expect(() => undercoverGame.createInitialState(["A", "B"], settings)).toThrow("3–12");
    expect(() => undercoverGame.createInitialState(["A", "B", "C"], { ...settings, undercoverCount: 2 })).toThrow("dua pemain Civilian");
    expect(() => undercoverGame.createInitialState(["A", "A", "C"], settings)).toThrow("unik");
    expect(() => undercoverGame.createInitialState(Array.from({ length: 13 }, (_, index) => `P${index}`), settings)).toThrow("3–12");
  });

  it("assigns related but distinct words and only exposes the viewer's private card", () => {
    const game = start();
    const roles = game.secret.assignments;
    expect(roles.filter((item) => item.role === "civilian")).toHaveLength(2);
    expect(roles.filter((item) => item.role === "undercover")).toHaveLength(1);
    expect(new Set(roles.filter((item) => item.word).map((item) => item.word)).size).toBe(2);
    const view = undercoverGame.getPlayerView(game, "player-1");
    expect(view?.private?.playerId).toBe("player-1");
    expect(view?.private?.word).not.toBe(game.secret.assignments.find((item) => item.playerId === "player-2")?.word);
    expect(undercoverGame.getPlayerView(game, "outsider")).toBeNull();
    expect(undercoverGame.getResult(game)).toBeNull();
  });

  it("never sends a role to the player while the game runs, and Mr. White's card has no word", () => {
    const game = start({ mrWhiteEnabled: true }, ["Alya", "Bima", "Citra", "Dewi"]);
    for (const { playerId, role, word } of game.secret.assignments) {
      const view = undercoverGame.getPlayerView(game, playerId)!;
      // Neither the card nor anything else in the view names a role during play.
      expect(Object.keys(view.private!).sort()).toEqual(["playerId", "word"]);
      expect(JSON.stringify(view)).not.toMatch(/"role"|"civilian"|"undercover"|"mr-white"/);
      expect(view.private!.word).toBe(word);
      if (role === "mr-white") expect(view.private!.word).toBeNull();
    }
  });

  it("requires a private hand-off before the clue window opens", () => {
    let game = start();
    expect(() => run(game, { type: "confirm-reveal", playerId: "outsider" })).toThrow("tidak ditemukan");
    game = run(game, { type: "confirm-reveal", playerId: "player-1" });
    expect(game.public.phase).toBe("reveal");
    game = revealAll(game);
    expect(game.public.phase).toBe("clue");
    expect(game.public.clueIndex).toBe(0);
    // Clues are spoken freely during the timed window: no per-player clue action exists.
    expect(() => run(game, { type: "submit-clue", playerId: "player-1" } as unknown as GameAction)).toThrow();
  });

  it("opens voting as soon as the clue window ends, without a discussion step", () => {
    const game = cluesAndVoting(start());
    expect(game.public.phase).toBe("voting");
    expect(game.public.clues).toHaveLength(0);
    expect(() => run(game, { type: "finish-discussion" })).toThrow("Diskusi belum");
  });

  it("opens voting once a majority of the living players ask for it, and lets them take the request back", () => {
    let game = revealAll(start({}, ["Alya", "Bima", "Citra", "Dara", "Eka"]));
    const ids = game.public.players.map((player) => player.id);
    game = run(game, { type: "request-vote", playerId: ids[0]! });
    game = run(game, { type: "request-vote", playerId: ids[1]! });
    expect(game.public.phase).toBe("clue");
    expect(game.public.voteRequests).toEqual([ids[0], ids[1]]);
    // Asking again withdraws the request.
    game = run(game, { type: "request-vote", playerId: ids[1]! });
    expect(game.public.voteRequests).toEqual([ids[0]]);
    game = run(game, { type: "request-vote", playerId: ids[1]! });
    expect(game.public.phase).toBe("clue");
    // 3 of 5 is a strict majority: voting opens at once with a clean slate.
    game = run(game, { type: "request-vote", playerId: ids[2]! });
    expect(game.public.phase).toBe("voting");
    expect(game.public.voteRequests).toEqual([]);
    expect(game.public.clueDeadlineAt).toBeNull();
    expect(game.public.votes).toEqual({});
  });

  it("needs more than half: 2 of 4 is not enough", () => {
    let game = revealAll(start({}, ["Alya", "Bima", "Citra", "Dara"]));
    const ids = game.public.players.map((player) => player.id);
    game = run(game, { type: "request-vote", playerId: ids[0]! });
    game = run(game, { type: "request-vote", playerId: ids[1]! });
    expect(game.public.phase).toBe("clue");
    game = run(game, { type: "request-vote", playerId: ids[2]! });
    expect(game.public.phase).toBe("voting");
  });

  it("carries the round setup in the public state for the intro popup", () => {
    const game = start({ mrWhiteEnabled: true, undercoverCount: 1, category: "hewan" }, ["Alya", "Bima", "Citra", "Dara"]);
    expect(game.public).toMatchObject({ category: "hewan", undercoverCount: 1, mrWhiteEnabled: true });
    // Counts and flags are room settings, not secrets: nobody's role or word is in the public state.
    expect(JSON.stringify(game.public)).not.toContain(game.secret.civilianWord);
  });

  it("does not let an eliminated player ask for voting", () => {
    let game = revealAll(start({}, ["Alya", "Bima", "Citra", "Dara", "Eka"]));
    game = endClueWindow(game, 0);
    const civilianId = game.secret.assignments.find((item) => item.role === "civilian")!.playerId;
    game = voteFor(game, civilianId);
    expect(game.public.phase).toBe("clue");
    expect(() => run(game, { type: "request-vote", playerId: civilianId })).toThrow("tidak aktif");
  });

  it("restores a saved local game from before voteRequests and category existed", () => {
    const game = start();
    const { voteRequests, category, ...older } = game.public;
    void voteRequests; void category;
    const restored = parseLocalGameState(JSON.stringify({ ...game, public: older }));
    expect(restored?.public.voteRequests).toEqual([]);
    expect(restored?.public.category).toBeUndefined();
  });

  it("only accepts vote requests during the clue phase", () => {
    const voting = endClueWindow(revealAll(start()), 0);
    expect(voting.public.phase).toBe("voting");
    expect(() => run(voting, { type: "request-vote", playerId: voting.public.players[0]!.id })).toThrow("ronde petunjuk");
    const reveal = start();
    expect(() => run(reveal, { type: "request-vote", playerId: reveal.public.players[0]!.id })).toThrow("ronde petunjuk");
  });

  it("runs one clue window per round and votes right after it", () => {
    let game = revealAll(start({}, ["Alya", "Bima", "Citra", "Dara", "Eka"]));
    expect(cluePassesForRound(game.public.round)).toBe(1);
    game = endClueWindow(game, 500_000);
    // The single window ends in voting; the timer is not started a second time.
    expect(game.public.phase).toBe("voting");
    expect(game.public.clueDeadlineAt).toBeNull();
    // Vote out a civilian: nobody has won yet, so the next round again has a single clue window.
    const civilianId = game.secret.assignments.find((item) => item.role === "civilian")!.playerId;
    game = voteFor(game, civilianId);
    expect(game.public.phase).toBe("clue");
    expect(game.public.round).toBe(2);
    expect(cluePassesForRound(game.public.round)).toBe(1);
    game = endClueWindow(game, 1_000_000);
    expect(game.public.phase).toBe("voting");
    expect(() => endClueWindow(game, 1_100_000)).toThrow("tidak aktif");
  });

  it("uses the configured clue minutes for every window and accepts only 1, 3, or 5", () => {
    let game = start({ clueMinutes: 5 });
    expect(game.public.clueMinutes).toBe(5);
    for (const player of game.public.players) game = run(game, { type: "confirm-reveal", playerId: player.id }, 1_000);
    expect(game.public.clueDeadlineAt).toBe(new Date(301_000).toISOString());
    for (const minutes of CLUE_MINUTES_OPTIONS) expect(start({ clueMinutes: minutes }).settings.clueMinutes).toBe(minutes);
    for (const minutes of [0, 2, 4, 6, 10]) expect(() => start({ clueMinutes: minutes }), String(minutes)).toThrow("tidak valid");
    expect(start({}).settings.clueMinutes).toBe(3);
  });

  it("opens the first clue window with a server supplied deadline", () => {
    let game = start();
    for (const player of game.public.players) game = run(game, { type: "confirm-reveal", playerId: player.id }, 1_000);
    expect(game.public.phase).toBe("clue");
    expect(game.public.clueDeadlineAt).toBe(new Date(181_000).toISOString());
  });

  it("lets Pass-and-Play finish one offline clue round and confirm its elimination", () => {
    let game = revealAll(start({}, ["Alya", "Bima", "Citra", "Dara"]));
    expect(game.public.phase).toBe("clue");
    game = finishOfflineClueRound(game);
    expect(game.public.phase).toBe("voting");
    expect(game.public.clues).toHaveLength(0);
    const civilianId = game.secret.assignments.find((assignment) => assignment.role === "civilian")!.playerId;
    game = confirmOfflineElimination(game, civilianId, 90_000);
    expect(game.public.players.find((player) => player.id === civilianId)?.alive).toBe(false);
    expect(game.public.phase).toBe("clue");
    expect(game.public.round).toBe(2);
    expect(game.public.clueDeadlineAt).toBe(new Date(270_000).toISOString());
    expect(() => confirmOfflineElimination(game, civilianId)).toThrow("tidak tersedia");
  });

  it("keeps the eliminated Mr. White guess step after offline confirmation", () => {
    let game = revealAll(start({ mrWhiteEnabled: true }, ["Alya", "Bima", "Citra", "Dara"]));
    game = finishOfflineClueRound(game);
    const whiteId = game.secret.assignments.find((assignment) => assignment.role === "mr-white")!.playerId;
    game = confirmOfflineElimination(game, whiteId);
    expect(game.public.phase).toBe("mr-white-guess");
    expect(game.public.eliminatedPlayerId).toBe(whiteId);
    expect(game.public.players.find((player) => player.id === whiteId)?.alive).toBe(false);
  });

  it("restores a valid local game state and rejects malformed saved state", () => {
    const game = start();
    expect(parseLocalGameState(JSON.stringify(game))).toEqual(game);
    expect(parseLocalGameState("not-json")).toBeNull();
    expect(parseLocalGameState(JSON.stringify({ public: { phase: "unknown" } }))).toBeNull();
  });

  it("rejects self-votes, inactive targets, and duplicate votes", () => {
    let game = cluesAndVoting(start());
    expect(() => run(game, { type: "cast-vote", playerId: "player-1", targetPlayerId: "player-1" })).toThrow("diri sendiri");
    game = run(game, { type: "cast-vote", playerId: "player-1", targetPlayerId: "player-2" });
    expect(undercoverGame.getPlayerView(game, "player-3")?.public.votes).toEqual({});
    expect(() => run(game, { type: "cast-vote", playerId: "player-1", targetPlayerId: "player-3" })).toThrow("sudah memilih");
    game = { ...game, public: { ...game.public, players: game.public.players.map((player) => ({ ...player, alive: player.id !== "player-3" })) } };
    expect(() => run(game, { type: "cast-vote", playerId: "player-2", targetPlayerId: "player-3" })).toThrow("Target tidak aktif");
  });

  it("allows one revote on a tie and proceeds without elimination after another tie", () => {
    let game = cluesAndVoting(start({}, ["Alya", "Bima", "Citra", "Dara"]));
    game = run(game, { type: "cast-vote", playerId: "player-1", targetPlayerId: "player-2" });
    game = run(game, { type: "cast-vote", playerId: "player-2", targetPlayerId: "player-1" });
    game = run(game, { type: "cast-vote", playerId: "player-3", targetPlayerId: "player-1" });
    game = run(game, { type: "cast-vote", playerId: "player-4", targetPlayerId: "player-2" });
    expect(game.public.phase).toBe("revote");
    expect(game.public.tiedPlayerIds).toContain("player-1");
    expect(() => run(game, { type: "cast-vote", playerId: "player-3", targetPlayerId: "player-3" })).toThrow("diri sendiri");
    game = run(game, { type: "cast-vote", playerId: "player-1", targetPlayerId: "player-2" });
    game = run(game, { type: "cast-vote", playerId: "player-2", targetPlayerId: "player-1" });
    game = run(game, { type: "cast-vote", playerId: "player-3", targetPlayerId: "player-1" });
    game = run(game, { type: "cast-vote", playerId: "player-4", targetPlayerId: "player-2" });
    expect(game.public.phase).toBe("clue");
    expect(game.public.lastRoundTied).toBe(true);
    expect(game.public.players.every((player) => player.alive)).toBe(true);
  });

  it("eliminates the top-voted player and ends when all opposing roles are gone", () => {
    let game = cluesAndVoting(start());
    const undercoverId = game.secret.assignments.find((item) => item.role === "undercover")!.playerId;
    game = voteFor(game, undercoverId);
    expect(game.public.phase).toBe("finished");
    expect(game.public.winner).toBe("civilian");
    expect(undercoverGame.getPlayerView(game, "player-1")?.result?.civilianWord).toBe(game.secret.civilianWord);
    expect(undercoverGame.getPlayerView(game, "player-1")?.private).toBeNull();
  });

  it("ends for Undercover when its living count reaches the Civilian count", () => {
    let game = cluesAndVoting(start());
    const undercoverId = game.secret.assignments.find((item) => item.role === "undercover")!.playerId;
    const civilianId = game.secret.assignments.find((item) => item.role === "civilian")!.playerId;
    game = voteFor(game, civilianId);
    expect(game.public.players.find((player) => player.id === civilianId)?.alive).toBe(false);
    expect(game.public.winner).toBe("undercover");
    expect(game.public.phase).toBe("finished");
    expect(game.secret.assignments.find((item) => item.playerId === undercoverId)?.role).toBe("undercover");
  });

  it("gives Mr. White one guess and rewards a correct answer", () => {
    let game = start({ mrWhiteEnabled: true }, ["Alya", "Bima", "Citra", "Dara"]);
    const whiteId = game.secret.assignments.find((item) => item.role === "mr-white")!.playerId;
    game = cluesAndVoting(game);
    game = voteFor(game, whiteId);
    expect(game.public.phase).toBe("mr-white-guess");
    expect(() => run(game, { type: "guess-civilian-word", playerId: whiteId, guess: "" })).toThrow("tidak valid");
    game = run(game, { type: "guess-civilian-word", playerId: whiteId, guess: game.secret.civilianWord.toLocaleUpperCase("id-ID") });
    expect(game.public.winner).toBe("mr-white");
    expect(undercoverGame.getResult(game)?.undercoverWord).toBe(game.secret.undercoverWord);
  });

  it("starts a new clue round when Mr. White guesses incorrectly and checks the normal win condition", () => {
    let game = start({ mrWhiteEnabled: true }, ["Alya", "Bima", "Citra", "Dara"]);
    const whiteId = game.secret.assignments.find((item) => item.role === "mr-white")!.playerId;
    game = cluesAndVoting(game);
    game = voteFor(game, whiteId);
    game = run(game, { type: "guess-civilian-word", playerId: whiteId, guess: "kata yang salah" });
    expect(game.public.phase).toBe("clue");
    expect(game.public.round).toBe(2);
    expect(game.public.players.find((player) => player.id === whiteId)?.alive).toBe(false);
  });
});
