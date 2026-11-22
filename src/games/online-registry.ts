import type { OnlineGameServer } from "@/games/online-game";
import { undercoverOnline } from "@/games/undercover/server/online";

/** Server-side registry of games playable in Online Room, keyed by game_rooms.game_key. */
const onlineGames: Record<string, OnlineGameServer> = {
  [undercoverOnline.key]: undercoverOnline,
};

export function getOnlineGame(key: string) {
  return Object.hasOwn(onlineGames, key) ? onlineGames[key]! : null;
}
