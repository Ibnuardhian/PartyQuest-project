import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function broadcastRoomChanged(roomId: string, version: number) {
  const supabase = createAdminClient();
  const channel = supabase.channel(`room:${roomId}`, { config: { private: true } });
  try {
    await channel.send({ type: "broadcast", event: "state_changed", payload: { version } });
  } finally {
    await supabase.removeChannel(channel);
  }
}
