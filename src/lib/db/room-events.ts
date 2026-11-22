import "server-only";
import pg from "pg";
import { getDatabaseUrl } from "@/lib/db/pool";

export const ROOM_CHANGED_CHANNEL = "partyquest_room_changed";
type Listener = () => void;

/**
 * One LISTEN connection per server process fans Postgres NOTIFY signals out to SSE subscribers.
 * Payloads carry only a room id; subscribers refetch their authorized view.
 */
class RoomEventHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async subscribe(roomId: string, listener: Listener) {
    const set = this.listeners.get(roomId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(roomId, set);
    try {
      await this.ensureConnected();
    } catch (error) {
      this.remove(roomId, listener);
      throw error;
    }
    return () => this.remove(roomId, listener);
  }

  private remove(roomId: string, listener: Listener) {
    const set = this.listeners.get(roomId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(roomId);
    if (this.listeners.size === 0 && this.client) {
      const client = this.client;
      this.client = null;
      void client.end().catch(() => {});
    }
  }

  private ensureConnected() {
    if (this.client) return Promise.resolve();
    this.connecting ??= this.connect().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  private async connect() {
    const client = new pg.Client({ connectionString: getDatabaseUrl() });
    client.on("notification", (message) => {
      if (message.channel !== ROOM_CHANGED_CHANNEL || !message.payload) return;
      this.listeners.get(message.payload)?.forEach((listener) => listener());
    });
    client.on("error", () => this.handleDisconnect(client));
    client.on("end", () => this.handleDisconnect(client));
    await client.connect();
    await client.query(`LISTEN ${ROOM_CHANGED_CHANNEL}`);
    this.client = client;
  }

  private handleDisconnect(client: pg.Client) {
    if (this.client !== client) return;
    this.client = null;
    void client.end().catch(() => {});
    if (this.listeners.size === 0 || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.size === 0) return;
      // Signals may have been missed while disconnected, so every subscriber refetches after reconnect.
      void this.ensureConnected().then(() => this.listeners.forEach((set) => set.forEach((listener) => listener()))).catch(() => this.scheduleRetry());
    }, 2000);
  }

  private scheduleRetry() {
    if (this.listeners.size === 0 || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected().catch(() => this.scheduleRetry());
    }, 5000);
  }
}

const globalForEvents = globalThis as typeof globalThis & { __partyquestRoomEvents?: RoomEventHub };

export function subscribeRoomChanges(roomId: string, listener: Listener) {
  globalForEvents.__partyquestRoomEvents ??= new RoomEventHub();
  return globalForEvents.__partyquestRoomEvents.subscribe(roomId, listener);
}
