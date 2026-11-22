"use client";

import { useEffect, useRef } from "react";

export type RoomEventStatus = "connecting" | "live" | "reconnecting";

/**
 * Subscribes to /api/rooms/<code>/events (SSE backed by Postgres LISTEN/NOTIFY).
 * Events are invalidation signals only; `onChange` should refetch the authorized view.
 * Callers keep a slow polling fallback for networks that block streaming.
 */
export function useRoomEvents(code: string | null, onChange: () => void, onStatus?: (status: RoomEventStatus) => void) {
  const changeRef = useRef(onChange);
  const statusRef = useRef(onStatus);
  useEffect(() => { changeRef.current = onChange; statusRef.current = onStatus; }, [onChange, onStatus]);

  useEffect(() => {
    if (!code || typeof EventSource === "undefined") return;
    statusRef.current?.("connecting");
    const source = new EventSource(`/api/rooms/${encodeURIComponent(code)}/events`);
    source.addEventListener("ready", () => {
      statusRef.current?.("live");
      // Catch up on anything that changed while the stream was down.
      changeRef.current();
    });
    source.addEventListener("changed", () => changeRef.current());
    source.onerror = () => statusRef.current?.("reconnecting");
    return () => source.close();
  }, [code]);
}
