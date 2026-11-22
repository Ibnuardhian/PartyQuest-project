import OnlineGame from "@/components/game/online-game";

export default async function OnlinePlayPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ session?: string }> }) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  if (!query.session) return <main className="page-shell"><section className="game-wrap"><div className="game-card"><h2>Sesi permainan tidak ditemukan.</h2><a className="text-button" href={`/room/${code}`}>Kembali ke lobi</a></div></section></main>;
  return <OnlineGame roomCode={code.toUpperCase()} sessionId={query.session} />;
}
