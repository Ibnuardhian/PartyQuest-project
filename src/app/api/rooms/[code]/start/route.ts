import { apiError, apiSuccess, mapDatabaseError } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { undercoverGame } from "@/games/undercover/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastRoomChanged } from "@/lib/supabase/realtime";

interface Member { user_id: string; display_name: string; is_ready: boolean; }

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const { code } = await params;
  try {
    const admin = createAdminClient();
    const { data: roomData } = await admin.from("game_rooms").select("id,host_user_id,settings").eq("code", code.toUpperCase()).maybeSingle();
    if (!roomData) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (roomData.host_user_id !== guest.userId) return apiError(403, "host_required", "Hanya host yang dapat memulai permainan.");
    const { data: membersData } = await admin.from("room_members").select("user_id,display_name,is_ready").eq("room_id", roomData.id).is("left_at", null).order("seat_no");
    const members = (membersData ?? []) as Member[];
    if (members.length < 3 || members.length > 12) return apiError(409, "invalid_player_count", "Permainan memerlukan 3–12 pemain.");
    if (new Set(members.map((member) => member.display_name.trim().toLocaleLowerCase("id-ID"))).size !== members.length) return apiError(409, "duplicate_name", "Nama pemain di room harus berbeda.");
    if (members.some((member) => !member.is_ready)) return apiError(409, "players_not_ready", "Semua pemain harus siap sebelum mulai.");
    const settings = undercoverGame.validateSettings(roomData.settings, members.length);
    const state = undercoverGame.createInitialState(members.map((member) => member.display_name), settings, undefined, members.map((member) => member.user_id));
    const { data, error } = await admin.rpc("start_game", {
      p_room_id: roomData.id,
      p_host_user_id: guest.userId,
      p_public_state: state.public,
      p_private_state: state.secret,
      p_player_private: state.secret.assignments,
    });
    if (error) {
      const mapped = mapDatabaseError(error.message);
      return apiError(mapped.status, mapped.code, mapped.message);
    }
    const session = Array.isArray(data) ? data[0] : data;
    if (!session) return apiError(503, "session_unavailable", "Permainan belum dapat dimulai.");
    await broadcastRoomChanged(roomData.id, 0);
    return apiSuccess({ sessionId: session.id, stateVersion: 0 }, 201);
  } catch {
    return apiError(503, "game_unavailable", "Permainan belum dapat dimulai. Periksa kesiapan pemain dan pengaturan.");
  }
}
