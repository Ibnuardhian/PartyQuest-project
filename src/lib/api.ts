import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string, details?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...details } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

const KNOWN_ERRORS: Record<string, { status: number; message: string }> = {
  rate_limited: { status: 429, message: "Terlalu banyak percobaan. Coba lagi sebentar." },
  room_not_found: { status: 404, message: "Room tidak ditemukan." },
  room_expired: { status: 410, message: "Room sudah kedaluwarsa." },
  room_not_joinable: { status: 409, message: "Room ini tidak menerima pemain baru." },
  room_not_in_lobby: { status: 409, message: "Room tidak sedang berada di lobi." },
  room_full: { status: 409, message: "Room sudah penuh." },
  not_a_member: { status: 403, message: "Kamu bukan anggota room ini." },
  host_required: { status: 403, message: "Hanya host yang dapat melakukan aksi ini." },
  room_not_startable: { status: 409, message: "Room belum dapat dimulai." },
  invalid_player_count: { status: 409, message: "Jumlah pemain belum memenuhi syarat." },
  invalid_player_state: { status: 409, message: "Daftar pemain berubah. Coba lagi." },
  players_not_ready: { status: 409, message: "Semua pemain harus siap sebelum mulai." },
  room_not_rematchable: { status: 409, message: "Room belum dapat memulai ulang." },
  room_in_progress: { status: 409, message: "Ronde yang sedang berjalan harus diselesaikan sebelum keluar." },
  version_conflict: { status: 409, message: "State permainan sudah berubah. Segarkan permainan." },
  session_not_found: { status: 404, message: "Permainan tidak ditemukan." },
  session_finished: { status: 409, message: "Permainan ini sudah selesai." },
  duplicate_name: { status: 409, message: "Nama pemain di room harus berbeda." },
  invalid_name: { status: 400, message: "Nama tampilan harus 1–24 karakter." },
};

export function mapDatabaseError(message: string) {
  const key = Object.keys(KNOWN_ERRORS).find((value) => message.includes(value));
  return key ? { code: key, ...KNOWN_ERRORS[key]! } : null;
}

/** Converts a raised PL/pgSQL error code into an API response, or a generic fallback. */
export function databaseErrorResponse(error: unknown, fallback: { status: number; code: string; message: string }) {
  const mapped = mapDatabaseError(error instanceof Error ? error.message : String(error));
  return mapped ? apiError(mapped.status, mapped.code, mapped.message) : apiError(fallback.status, fallback.code, fallback.message);
}

export const UNAUTHORIZED_MESSAGE = "Buat sesi tamu terlebih dahulu.";
