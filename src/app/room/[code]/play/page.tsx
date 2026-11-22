import { getGameModule } from "@/games/registry";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode } from "@/lib/rooms/repository";

export const dynamic = "force-dynamic";

function Missing({ code, message }: { code: string; message: string }) {
  return <main className="page-shell"><section className="game-wrap"><div className="game-card"><h2>{message}</h2><a className="text-button" href={`/room/${code}`}>Kembali ke lobi</a></div></section></main>;
}

/** Dispatches to the room's game. The game component fetches its own authorized view. */
export default async function OnlinePlayPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ session?: string }> }) {
  const [{ code: rawCode }, query] = await Promise.all([params, searchParams]);
  const code = normalizeRoomCode(rawCode);
  if (!code) return <Missing code={rawCode} message="Room tidak ditemukan." />;
  if (!query.session) return <Missing code={code} message="Sesi permainan tidak ditemukan." />;
  // Only the public game key is read here; membership and private state are checked by the API.
  const room = await findRoomByCode(code).catch(() => null);
  const OnlineGame = room ? getGameModule(room.game_key)?.OnlineGame : undefined;
  if (!OnlineGame) return <Missing code={code} message="Permainan room ini belum tersedia." />;
  return <OnlineGame roomCode={code} sessionId={query.session} />;
}
