import RoomLobby from "@/components/lobby/room-lobby";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode } from "@/lib/rooms/repository";

// The game key is read per request so the lobby is themed in the very first HTML (no flash of the platform theme).
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode) ?? rawCode.toUpperCase();
  // Only the public game key is used here; membership is still enforced by the API.
  const room = await findRoomByCode(code).catch(() => null);
  return <RoomLobby code={code} initialGameKey={room?.game_key ?? null} />;
}
