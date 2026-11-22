import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function mapDatabaseError(message: string) {
  const known: Record<string, { status: number; message: string }> = {
    rate_limited: { status: 429, message: "Terlalu banyak percobaan. Coba lagi sebentar." },
    room_not_found: { status: 404, message: "Room tidak ditemukan." },
    room_expired: { status: 410, message: "Room sudah kedaluwarsa." },
    room_not_joinable: { status: 409, message: "Room ini tidak menerima pemain baru." },
    room_full: { status: 409, message: "Room sudah penuh." },
    not_a_member: { status: 403, message: "Kamu bukan anggota room ini." },
    host_required: { status: 403, message: "Hanya host yang dapat melakukan aksi ini." },
    room_not_startable: { status: 409, message: "Room belum dapat dimulai." },
    invalid_player_count: { status: 409, message: "Jumlah pemain belum memenuhi syarat." },
    players_not_ready: { status: 409, message: "Semua pemain harus siap sebelum mulai." },
    room_not_rematchable: { status: 409, message: "Room belum dapat memulai ulang." },
    room_in_progress: { status: 409, message: "Ronde yang sedang berjalan harus diselesaikan sebelum keluar." },
    version_conflict: { status: 409, message: "State permainan sudah berubah. Segarkan permainan." },
    session_finished: { status: 409, message: "Permainan ini sudah selesai." },
    duplicate_name: { status: 409, message: "Nama pemain di room harus berbeda." },
    invalid_name: { status: 400, message: "Nama tampilan harus 1–24 karakter." },
  };
  const key = Object.keys(known).find((value) => message.includes(value));
  return key ? { code: key, ...known[key]! } : { code: "request_failed", status: 400, message: "Permintaan tidak dapat diproses." };
}
