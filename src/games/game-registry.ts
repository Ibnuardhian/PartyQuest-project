import type { GameDefinition } from "@/games/game-contract";
import { undercoverGame } from "@/games/undercover/engine";

export const gameRegistry = {
  undercover: undercoverGame,
} satisfies Record<string, GameDefinition>;

export type GameKey = keyof typeof gameRegistry;
