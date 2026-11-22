import { apiError, UNAUTHORIZED_MESSAGE } from "@/lib/api";
import { requireGuest } from "@/lib/auth/require-guest";
import { subscribeRoomChanges } from "@/lib/db/room-events";
import { normalizeRoomCode } from "@/lib/room-code";
import { findRoomByCode, isActiveMember } from "@/lib/rooms/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const MEMBERSHIP_RECHECK_MS = 60_000;

/**
 * Server-Sent Events stream for active room members. Each event is only an invalidation signal
 * ("changed"); clients refetch their authorized view. No game or private state is sent here.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guest = await requireGuest();
  if (!guest) return apiError(401, "unauthorized", UNAUTHORIZED_MESSAGE);
  const code = normalizeRoomCode((await params).code);
  if (!code) return apiError(404, "room_not_found", "Room tidak ditemukan.");
  let roomId: string;
  try {
    const room = await findRoomByCode(code);
    if (!room) return apiError(404, "room_not_found", "Room tidak ditemukan.");
    if (!(await isActiveMember(room.id, guest.userId))) return apiError(403, "not_a_member", "Kamu bukan anggota room ini.");
    roomId = room.id;
  } catch {
    return apiError(503, "room_unavailable", "Room belum dapat dimuat.");
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { close(); }
      };
      let unsubscribe: () => void = () => {};
      try {
        unsubscribe = await subscribeRoomChanges(roomId, () => send("event: changed\ndata: {}\n\n"));
      } catch {
        send("retry: 5000\nevent: unavailable\ndata: {}\n\n");
        close();
        return;
      }
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      // Stop streaming to someone who has left the room.
      const membership = setInterval(() => {
        void isActiveMember(roomId, guest.userId).then((active) => { if (!active) close(); }).catch(() => {});
      }, MEMBERSHIP_RECHECK_MS);
      cleanup = () => { clearInterval(heartbeat); clearInterval(membership); unsubscribe(); };
      request.signal.addEventListener("abort", close);
      send("retry: 3000\nevent: ready\ndata: {}\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
