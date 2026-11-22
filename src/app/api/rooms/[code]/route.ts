import { apiError, apiSuccess } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { createAdminClient } from "@/lib/supabase/admin";

interface RoomRow { id: string; code: string; host_user_id: string; status: string; settings: unknown; expires_at: string; max_players: number; }
interface MemberRow { user_id: string; display_name: string; seat_no: number; is_ready: boolean; is_alive: boolean; }

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", "Buat sesi tamu terlebih dahulu.");
  const { code } = await params;
  try {
    const admin = createAdminClient();
    const { data: roomData, error } = await admin.from("game_rooms").select("id,code,host_user_id,status,settings,expires_at,max_players").eq("code", code.toUpperCase()).maybeSingle();
    if (error || !roomData) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    const room = roomData as RoomRow;
    if (new Date(room.expires_at).getTime() <= Date.now()) return apiError(410, "room_expired", "Room ini sudah kedaluwarsa.");
    const { data: member } = await admin.from("room_members").select("id").eq("room_id", room.id).eq("user_id", guest.userId).is("left_at", null).maybeSingle();
    if (!member) return apiError(403, "not_a_member", "Gabung ke room ini untuk melihat lobi.");
    const [{ data: membersData }, { data: sessionData }] = await Promise.all([
      admin.from("room_members").select("user_id,display_name,seat_no,is_ready,is_alive").eq("room_id", room.id).is("left_at", null).order("seat_no"),
      admin.from("game_sessions").select("id,round_no,status,state_version,phase").eq("room_id", room.id).order("round_no", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return apiSuccess({
      room: { id: room.id, code: room.code, status: room.status, settings: room.settings, expiresAt: room.expires_at, maxPlayers: room.max_players },
      members: (membersData ?? []) as MemberRow[],
      session: sessionData,
      currentUserId: guest.userId,
      hostUserId: room.host_user_id,
      isHost: room.host_user_id === guest.userId,
    });
  } catch {
    return apiError(503, "room_unavailable", "Room belum dapat dimuat.");
  }
}
