import { z } from "zod";
import type { GameState } from "@/games/undercover/contract";

export const LOCAL_GAME_PATH = "/games/undercover/local";
export const LOCAL_GAME_STORAGE_KEY = "partyquest:undercover:local:v2";
const LEGACY_LOCAL_GAME_STORAGE_KEY = "partyquest:undercover:local:v1";

const localStateSchema = z.object({
  public: z.object({
    phase: z.enum(["reveal", "clue", "discussion", "voting", "revote", "mr-white-guess", "finished"]),
    players: z.array(z.object({ id: z.string(), name: z.string(), alive: z.boolean() })).min(3).max(12),
    round: z.number().int().min(1),
    revealIndex: z.number().int().min(0),
    revealedPlayerIds: z.array(z.string()),
    clueIndex: z.number().int().min(0),
    clueDeadlineAt: z.string().datetime().nullable(),
    clues: z.array(z.object({ playerId: z.string() })),
    votes: z.record(z.string(), z.string()),
    tiedPlayerIds: z.array(z.string()),
    revoteUsed: z.boolean(),
    eliminatedPlayerId: z.string().nullable(),
    winner: z.enum(["civilian", "undercover", "mr-white"]).nullable(),
    resultReason: z.string().nullable(),
    lastRoundTied: z.boolean(),
  }),
  secret: z.object({
    civilianWord: z.string(),
    undercoverWord: z.string(),
    assignments: z.array(z.object({ playerId: z.string(), role: z.enum(["civilian", "undercover", "mr-white"]), word: z.string().nullable() })),
  }),
  settings: z.object({
    category: z.enum(["makanan", "hewan", "benda", "tempat", "pekerjaan", "campuran"]),
    undercoverCount: z.number().int().min(1).max(4),
    mrWhiteEnabled: z.boolean(),
  }),
});

const localSessionSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  salt: z.string().regex(/^[0-9a-f]{64}$/),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  state: localStateSchema,
});

export type LocalGameSession = {
  id: string;
  salt: string;
  hash: string;
  state: GameState;
};

export function parseLocalGameState(serialized: string | null): GameState | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = localStateSchema.safeParse(parsed);
    return result.success ? result.data as GameState : null;
  } catch {
    return null;
  }
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashLocalGameId(id: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${id}`);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createLocalGameSession(state: GameState): Promise<LocalGameSession> {
  const id = randomHex(32);
  const salt = randomHex(32);
  return { id, salt, hash: await hashLocalGameId(id, salt), state };
}

function parseLocalGameSession(serialized: string | null): LocalGameSession | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = localSessionSchema.safeParse(parsed);
    return result.success ? result.data as LocalGameSession : null;
  } catch {
    return null;
  }
}

export async function readLocalGameSession(): Promise<LocalGameSession | null> {
  try {
    const serialized = window.sessionStorage.getItem(LOCAL_GAME_STORAGE_KEY);
    if (serialized) {
      const session = parseLocalGameSession(serialized);
      if (!session || session.hash !== await hashLocalGameId(session.id, session.salt)) {
        window.sessionStorage.removeItem(LOCAL_GAME_STORAGE_KEY);
        return null;
      }
      return session;
    }

    // Migrate a game saved before per-session URL hashes were introduced.
    const legacySerialized = window.sessionStorage.getItem(LEGACY_LOCAL_GAME_STORAGE_KEY);
    const legacyState = parseLocalGameState(legacySerialized);
    if (!legacyState) {
      if (legacySerialized) window.sessionStorage.removeItem(LEGACY_LOCAL_GAME_STORAGE_KEY);
      return null;
    }
    const migrated = await createLocalGameSession(legacyState);
    window.sessionStorage.setItem(LOCAL_GAME_STORAGE_KEY, JSON.stringify(migrated));
    window.sessionStorage.removeItem(LEGACY_LOCAL_GAME_STORAGE_KEY);
    return migrated;
  } catch {
    return null;
  }
}

export function writeLocalGameSession(session: LocalGameSession): boolean {
  try {
    window.sessionStorage.setItem(LOCAL_GAME_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalGameState(): void {
  try {
    window.sessionStorage.removeItem(LOCAL_GAME_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_LOCAL_GAME_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}
