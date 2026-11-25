import type { GameModule } from "@/games/types";
import { undercoverModule } from "@/games/undercover";
import { werewolfModule } from "@/games/werewolf";

/** Games shown in the catalog, in display order. Add a new game folder here. */
export const gameModules: GameModule[] = [undercoverModule, werewolfModule];

export function getGameModule(key: string) {
  return gameModules.find((game) => game.key === key) ?? null;
}

/** The game the header's "Online Room" shortcut opens. */
