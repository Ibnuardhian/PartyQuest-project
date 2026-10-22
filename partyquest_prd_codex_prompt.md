# PartyQuest: Product Specification dan Prompt Codex

**Status:** MVP proposal  
**Nama produk:** PartyQuest (nama kerja, dapat diganti)  
**Bahasa UI awal:** Bahasa Indonesia  
**Target deployment:** Vercel + Supabase  
**Sasaran MVP:** Dua game co-op yang dapat dimainkan sampai selesai, dengan fondasi modular untuk menambahkan game berikutnya.

---

# Bagian A. Product Specification

## 1. Ringkasan Produk

PartyQuest adalah platform web multiplayer untuk memainkan beberapa boardgame, card game, detective mystery, dan cooperative puzzle dalam satu website. Pengguna tidak perlu mendaftar dengan email atau kata sandi. Mereka memasukkan nama tampilan, lalu membuat atau bergabung ke room.

Setiap game harus dapat memilih mode permainan yang didukung:

1. **Pass-and-Play:** semua pemain memakai satu perangkat secara bergiliran. Informasi rahasia ditampilkan melalui layar hand-off agar pemain berikutnya tidak langsung melihat petunjuk sebelumnya.
2. **Online Room:** setiap pemain menggunakan HP atau browser sendiri. Host membuat room dan membagikan kode atau QR.
3. **Host Display:** opsi tambahan pada Online Room. Satu layar menjadi papan bersama yang tidak menerima petunjuk pribadi, sementara pemain melakukan aksi dan melihat kartu rahasia dari perangkat masing-masing.

MVP harus fokus pada permainan co-op berdurasi sekitar 15 sampai 30 menit. Pemain bekerja sama untuk mencapai satu tujuan, bukan hanya mengumpulkan skor individu.

## 2. Tujuan dan Non-goals

### Tujuan MVP

- Satu katalog game dengan kartu game, jumlah pemain, durasi, kategori, dan instruksi singkat.
- Guest identity tanpa registrasi email atau password.
- Pembuatan room, kode room yang mudah dibagikan, QR, lobby, status siap, mulai game, hasil, dan rematch.
- Mendukung Pass-and-Play dan Online Room.
- Dua game co-op lengkap dan dapat dimainkan dari awal sampai akhir.
- Host dapat memilih game dan memulai sesi ketika jumlah pemain memenuhi syarat.
- Pemain melihat state publik bersama, tetapi hanya menerima petunjuk privat miliknya.
- UI responsif untuk HP, tablet, dan laptop.
- Testing aturan game, API, otorisasi, RLS, dan alur multiplayer.
- Deployment yang terdokumentasi untuk Vercel dan Supabase.

### Bukan target MVP

- Akun permanen, profil lintas perangkat, dan pemulihan akun.
- Voice chat, video chat, atau chat bebas yang membutuhkan moderasi.
- Marketplace, sistem pembayaran, atau monetisasi.
- Editor untuk membuat game sendiri.
- Matchmaking publik, ranking global, dan leaderboard kompetitif.
- Multiplayer real-time berkecepatan tinggi seperti game aksi.
- Banyak game sekaligus sebelum dua game MVP benar-benar selesai.

## 3. Pengguna dan Peran

### Pengguna

- **Host:** membuat room, memilih game dan pengaturan, memulai sesi, mengakhiri sesi, serta memulai rematch. Hak host atas room tidak otomatis memberinya akses ke semua petunjuk privat.
- **Player:** bergabung ke room, menandai siap, menerima petunjuk miliknya, dan menjalankan aksi yang diizinkan engine.
- **Display:** perangkat yang menampilkan papan publik untuk semua orang. Display tidak memperoleh petunjuk privat dan tidak menjalankan aksi khusus pemain.
- **Local Player:** pemain Pass-and-Play dengan kursi lokal. Tidak membutuhkan akun Supabase untuk menjalankan sesi lokal.

Untuk Online Room, hak mengontrol room harus dipisahkan dari hak bermain. Host dapat memilih `host_mode = player` atau `host_mode = display_only`.

## 4. Mode dan Alur Utama

### 4.1 Pass-and-Play

1. Pengguna memilih game dan mode Pass-and-Play.
2. Memasukkan nama 2 sampai 6 pemain atau sesuai batas game.
3. Game membuat sesi lokal.
4. Saat petunjuk rahasia perlu dilihat, tampilkan halaman hand-off: "Berikan perangkat kepada pemain berikutnya".
5. Pemain menekan tombol untuk membuka petunjuknya.
6. Setelah melihat petunjuk, pemain menutup tampilan privat sebelum perangkat diteruskan.
7. Aksi game menggunakan engine game yang sama dengan Online Room.
8. State boleh disimpan sementara di localStorage agar refresh tidak langsung menghapus sesi. Sediakan tombol hapus/keluar sesi.

Tidak boleh mengklaim bahwa informasi di perangkat bersama terlindungi dari inspeksi browser. Mode ini hanya memberikan privasi melalui alur UI dan pergantian pemain.

### 4.2 Online Room

1. Pengguna membuka website dan memperoleh guest session.
2. Host memilih game, Online Room, kapasitas pemain, dan mode host.
3. Server membuat kode room acak 6 karakter dengan huruf/angka yang menghindari karakter ambigu seperti O/0 dan I/1.
4. Host membagikan kode atau QR.
5. Pemain masuk dengan kode dan nama tampilan.
6. Lobby menampilkan nama, status koneksi, status siap, dan host.
7. Host memulai game hanya jika jumlah pemain dan kondisi siap sesuai aturan game.
8. Server membuat game session dan menetapkan petunjuk privat untuk setiap pemain.
9. Perubahan state publik disebarkan sebagai notifikasi real-time. Klien mengambil view yang diotorisasi dari endpoint server.
10. Game berakhir dengan hasil menang/kalah atau hasil sesuai aturan.
11. Host dapat rematch dengan game/settings yang sama atau kembali ke katalog.

### 4.3 Host Display

- Display hanya mendapatkan state publik dan informasi presentasi.
- Display tidak menerima `player_private_state`.
- Jika host memilih mode display-only, host tidak dimasukkan sebagai pemain kecuali ia secara eksplisit memilih bergabung sebagai pemain melalui identitas atau kursi yang terpisah.
- Jika perangkat host ditutup, room masih dapat berjalan jika session dan state tersimpan di database.

## 5. Katalog dan Game MVP

Katalog boleh menampilkan kategori atau game berstatus "Segera hadir", tetapi hanya dua game berikut yang boleh ditampilkan sebagai playable sampai kedua game lulus acceptance criteria.

### Game 1: Case File, "Kasus di Galeri Senja"

- **Kategori:** Detective / Cooperative Deduction
- **Pemain:** 2 sampai 6
- **Durasi target:** 20 sampai 25 menit
- **Mode:** Pass-and-Play dan Online Room
- **Tujuan:** tim menemukan pelaku, motif, dan cara kejadian dalam kasus fiktif.
- **Loop utama:** setiap pemain menerima petunjuk privat berbeda; tim mendiskusikan informasi; pemain dapat mengajukan petunjuk untuk dipublikasikan; tim memeriksa bukti publik; tim mengunci satu tuduhan bersama.
- **Aturan minimum:**
  - Kasus memiliki kunci jawaban dan clue set yang deterministik.
  - Petunjuk privat tidak dapat diambil melalui API oleh pemain lain.
  - Pemain harus mempublikasikan atau menyampaikan informasi secara eksplisit dalam game.
  - Minimal sejumlah bukti harus dibuka sebelum tuduhan akhir tersedia.
  - Batasi jumlah tuduhan, misalnya dua kesempatan.
  - Hasil ditentukan engine, bukan keputusan dari klien.
  - Game memiliki kondisi menang, kalah, bantuan/petunjuk opsional, dan penjelasan jawaban setelah selesai.
- **Konten MVP:** satu kasus lengkap dengan suspect, motive, method, timeline, public evidence, dan private clues yang konsisten satu sama lain.

### Game 2: Signal Lost, "Stasiun Relay"

- **Kategori:** Cooperative Escape Room / Puzzle
- **Pemain:** 2 sampai 6
- **Durasi target:** 15 sampai 20 menit
- **Mode:** Pass-and-Play dan Online Room
- **Tujuan:** tim memulihkan tiga modul sistem sebelum energi atau waktu habis.
- **Loop utama:** tiap pemain menerima fragmen informasi yang berbeda; tim menggabungkan petunjuk; pemain mengirim jawaban untuk puzzle; jawaban salah mengurangi resource; jawaban benar membuka tahap berikutnya.
- **Aturan minimum:**
  - Tiga tahap puzzle yang saling berurutan.
  - Masing-masing tahap mengharuskan pemain menggabungkan informasi, bukan sekadar menebak angka acak.
  - State publik menampilkan progres, resource tersisa, dan puzzle aktif.
  - State privat menyimpan fragmen petunjuk milik pemain.
  - Timer menggunakan timestamp/deadline otoritatif dari server. Klien hanya menghitung tampilan sisa waktu.
  - Aksi jawaban divalidasi server-side.
  - Game memiliki kondisi menang, kalah, dan penjelasan solusi.

### Aturan konten

Buat nama, cerita, ilustrasi sederhana, susunan puzzle, kartu, dan teks orisinal. Jangan menyalin nama, teks, aset, atau aturan proprietary dari game komersial. Referensi dari game lain hanya untuk memahami mekanik umum seperti pembagian informasi dan deduksi.

## 6. Stack Teknis

- **Framework:** Next.js App Router dan TypeScript.
- **UI:** Tailwind CSS dan shadcn/ui atau komponen accessible setara.
- **Backend/database:** Supabase PostgreSQL.
- **Guest identity dan sesi server-rendered:** Supabase Auth anonymous sign-in dengan integrasi SSR/cookie yang sesuai dengan dokumentasi Supabase terbaru.
- **Realtime:** Supabase Realtime Broadcast untuk notifikasi perubahan state; Presence untuk indikator online jika diperlukan. Pesan Broadcast tidak boleh memuat petunjuk privat atau keseluruhan state rahasia.
- **Validation:** Zod untuk input API, settings, dan payload action.
- **Testing:** Vitest untuk unit tests, Playwright untuk end-to-end, dan pgTAP/Supabase database tests untuk RLS jika Supabase CLI tersedia.
- **Deployment:** Vercel untuk aplikasi Next.js; Supabase untuk database, auth, dan Realtime.
- **QR:** library React QR yang terpelihara atau generator QR setara.
- **Logging:** log terstruktur di server tanpa mencatat kartu privat, token, secret, atau data autentikasi.

Gunakan versi library stabil yang kompatibel pada saat implementasi. Jangan memaksakan versi lama hanya karena ada di contoh prompt.

## 7. Arsitektur Modular Game Engine

Semua game harus menggunakan kontrak engine yang sama. Pisahkan aturan game dari UI, persistence, auth, dan transport real-time.

Contoh kontrak konseptual:

```ts
interface GameDefinition<PublicState, PrivateState, Action, Settings> {
  key: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  supportsPassAndPlay: boolean;
  supportsOnline: boolean;
  defaultDurationMinutes: number;
  validateSettings(input: unknown): Settings;
  createInitialState(context: GameContext, settings: Settings): PublicState;
  createPrivateState(context: GameContext, playerId: string): PrivateState;
  validateAction(context: ActionContext, action: Action): ValidationResult;
  applyAction(state: PublicState, privateState: PrivateStateMap, context: ActionContext, action: Action): EngineResult;
  getPlayerView(state: PublicState, privateState: PrivateState | null, viewer: ViewerContext): PlayerView;
  getResult(state: PublicState): GameResult | null;
}
```

Nama tipe di atas adalah ilustrasi. Codex harus menyusun kontrak TypeScript yang praktis, ketat, dan tidak menggunakan `any` sebagai jalan pintas.

Prinsip wajib:

- Engine berisi fungsi murni sebisa mungkin dan dapat diuji tanpa browser, database, atau Realtime.
- `game-registry.ts` mendaftarkan game melalui manifest yang bertipe.
- Setiap game mengimplementasikan engine dan komponen UI sendiri, tetapi menggunakan room, identitas, lobby, hasil, dan rematch yang sama.
- Gunakan adapter terpisah untuk state lokal dan persistence online.
- Jangan menganggap state dari browser sebagai sumber kebenaran pada mode online.
- Aksi dikirim sebagai intent, bukan sebagai penggantian seluruh state dari klien.
- Engine menentukan apakah aksi sah, siapa yang boleh melakukannya, dan perubahan state yang dihasilkan.
- Gunakan `state_version` untuk concurrency control. Aksi dengan versi kedaluwarsa harus ditolak dengan respons conflict lalu klien melakukan refresh.
- State timer harus menggunakan `started_at`/`deadline_at`, bukan mempercayai jam perangkat pemain.

## 8. Arsitektur Keamanan Online

### 8.1 Sumber kebenaran

- Database/server adalah sumber kebenaran online untuk state, phase, giliran, timer, hasil, host, dan membership.
- Browser hanya mengirim action yang diinginkan.
- Server memvalidasi identitas, keanggotaan room, role, phase, action schema, batas jumlah aksi, dan versi state sebelum menyimpan aksi.
- Gunakan operasi database transaksional atau optimistic concurrency yang atomik agar dua aksi bersamaan tidak menimpa satu sama lain.
- Untuk update state dan event history, gunakan transaksi atau fungsi database/RPC yang menjaga keduanya atomik. Jangan membuat state berubah tetapi event tidak tercatat karena request terputus.

### 8.2 Pemisahan state publik dan privat

- `game_sessions.public_state` hanya boleh berisi informasi yang memang boleh dilihat semua anggota room.
- `player_private_state` menyimpan petunjuk per pemain.
- Data rahasia engine seperti solusi kasus atau jawaban puzzle disimpan pada tabel server-only, bukan pada state publik.
- Petunjuk privat diambil lewat endpoint server yang mengautentikasi pengguna dan memastikan membership serta hak akses.
- `getPlayerView` hanya mengembalikan state publik ditambah petunjuk untuk viewer yang sedang terautentikasi.
- Host display hanya menerima state publik.
- Jangan mengirim rahasia ke browser lalu menyembunyikannya dengan CSS, conditional rendering, atau state React.
- Jangan menyertakan private clues, jawaban rahasia, token, atau seluruh state privat di Broadcast, event publik, error messages, analytics, atau logs.

### 8.3 Supabase dan secrets

- Aktifkan RLS pada seluruh tabel yang terekspos melalui API.
- Uji grants dan policies. RLS tidak otomatis mencabut grants yang sudah diberikan.
- Klien browser hanya menggunakan publishable key.
- Secret/service key hanya berada di environment server dan tidak pernah memakai prefix `NEXT_PUBLIC_`.
- Jika route memakai elevated server client, autentikasi dan otorisasi user harus diverifikasi lebih dulu. Jangan mempercayai `user_id`, `room_id`, atau role yang dikirim dari browser.
- Client tidak boleh menulis langsung ke tabel `game_sessions`, private state, atau event history. Mutasi dilakukan melalui route handler atau RPC yang terkontrol.
- Batasi subscription Realtime ke room yang telah diotorisasi. Pesan Realtime hanya berupa `state_changed` dan versi; klien mengambil view yang sesuai melalui API.
- Validasi `room_code`, nama tampilan, settings, dan action payload. Batasi panjang input dan frekuensi pembuatan room/join.
- Guest identity tidak sama dengan identitas permanen. Jelaskan bahwa menghapus data browser dapat menghilangkan akses ke sesi guest.
- Untuk deployment publik, pertimbangkan CAPTCHA seperti Turnstile untuk anonymous sign-in dan mekanisme rate limit. Tambahkan rencana cleanup untuk room lama dan anonymous users sesuai kebijakan retensi.

## 9. Rancangan Database

Gunakan UUID untuk primary key. Nama field dan enum dapat disesuaikan, tetapi semantik dan batas akses wajib dipertahankan. Semua perubahan skema harus berupa migration SQL yang tersimpan di repository.

### `guest_profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `avatar_color text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `last_seen_at timestamptz null`

### `game_rooms`

- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `host_user_id uuid not null references auth.users(id)`
- `game_key text not null`
- `status text not null` dengan nilai seperti `lobby`, `in_progress`, `finished`, `abandoned`
- `host_mode text not null` dengan nilai `player` atau `display_only`
- `max_players int not null`
- `settings jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `expires_at timestamptz not null`

### `room_members`

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references game_rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `display_name text not null`
- `role text not null` dengan nilai seperti `host_player`, `host_display`, `player`, `display`
- `seat_no int null`
- `is_ready boolean not null default false`
- `joined_at timestamptz not null default now()`
- `last_seen_at timestamptz null`
- `left_at timestamptz null`
- Tambahkan constraint/index yang mencegah duplicate membership aktif dan seat aktif ganda.

### `game_sessions`

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references game_rooms(id) on delete cascade`
- `round_no int not null`
- `status text not null` dengan nilai `in_progress`, `won`, `lost`, `abandoned`
- `phase text not null`
- `state_version bigint not null default 0`
- `public_state jsonb not null`
- `started_at timestamptz not null default now()`
- `deadline_at timestamptz null`
- `finished_at timestamptz null`
- `created_at timestamptz not null default now()`
- Constraint unique `(room_id, round_no)`.

### `game_private_state`

- `session_id uuid primary key references game_sessions(id) on delete cascade`
- `private_state jsonb not null`
- `updated_at timestamptz not null default now()`
- Berisi jawaban/seed/state rahasia server. Akses hanya melalui server dengan elevated credentials. Jangan memberi akses tabel ini ke role browser.

### `player_private_state`

- `session_id uuid not null references game_sessions(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `private_state jsonb not null`
- `updated_at timestamptz not null default now()`
- Primary key `(session_id, user_id)`.
- Tabel server-only. Tidak boleh dapat dibaca pemain lain melalui SQL/Data API atau Realtime.

### `game_events`

- `id bigint generated always as identity primary key`
- `session_id uuid not null references game_sessions(id) on delete cascade`
- `seq bigint not null`
- `actor_user_id uuid null references auth.users(id) on delete set null`
- `event_type text not null`
- `public_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- Unique `(session_id, seq)`.
- Simpan event publik saja. Jangan simpan kartu privat atau solusi rahasia pada tabel ini.

### Indeks minimum

- `game_rooms(code)` unique.
- `game_rooms(status, expires_at)`.
- `room_members(room_id, left_at)`.
- `room_members(user_id, left_at)`.
- `game_sessions(room_id, round_no)` unique.
- `game_events(session_id, seq)` unique.

### Catatan implementasi database

- Katalog statis game dapat tetap menjadi TypeScript manifest pada MVP, tidak perlu tabel `games` sampai ada kebutuhan admin untuk mengelola katalog.
- Mode Pass-and-Play tidak perlu membuat record room online. Simpan sesi lokal pada client saja.
- Mutasi state online, increment version, dan pencatatan event harus atomik. Pilih RPC/function atau transaction-capable server path yang sesuai dengan Supabase.
- Jangan menyimpan state rahasia pada kolom yang bisa dibaca anggota room.

## 10. API/Route Handler yang Disarankan

Semua endpoint harus mengembalikan response JSON konsisten, memvalidasi payload, dan memberi status code yang sesuai.

- `POST /api/guest/ensure-profile`: memastikan anonymous session tersedia dan membuat/memperbarui profile.
- `POST /api/rooms`: membuat room online.
- `POST /api/rooms/join`: join dengan code.
- `GET /api/rooms/[code]`: memperoleh lobby view yang diotorisasi.
- `POST /api/rooms/[code]/ready`: mengubah status ready milik user aktif.
- `POST /api/rooms/[code]/start`: hanya host yang boleh mulai; validasi jumlah pemain dan kesiapan.
- `POST /api/rooms/[code]/leave`: keluar dari room.
- `GET /api/sessions/[sessionId]/view`: mengembalikan view publik plus informasi privat untuk user tersebut jika role boleh mendapatkannya.
- `POST /api/sessions/[sessionId]/actions`: menjalankan action lewat engine, cek `expectedVersion`, update state secara atomik, simpan event, lalu kirim notifikasi Realtime.
- `POST /api/rooms/[code]/rematch`: host memulai sesi baru dengan pengaturan valid.

Codex boleh memilih struktur route yang berbeda apabila konsisten, aman, dan terdokumentasi.

## 11. Struktur Folder yang Disarankan

```text
src/
  app/
    page.tsx
    games/[gameKey]/page.tsx
    room/new/page.tsx
    room/[code]/page.tsx
    room/[code]/play/page.tsx
    room/[code]/display/page.tsx
    local/[sessionId]/page.tsx
    api/
      guest/ensure-profile/route.ts
      rooms/route.ts
      rooms/join/route.ts
      rooms/[code]/route.ts
      rooms/[code]/ready/route.ts
      rooms/[code]/start/route.ts
      sessions/[sessionId]/view/route.ts
      sessions/[sessionId]/actions/route.ts
  components/
    catalog/
    lobby/
    room/
    game-ui/
    shared/
  games/
    game-contract.ts
    game-registry.ts
    case-file/
      manifest.ts
      engine.ts
      schemas.ts
      ui/
      __tests__/
    signal-lost/
      manifest.ts
      engine.ts
      schemas.ts
      ui/
      __tests__/
  lib/
    auth/
    supabase/
    validation/
    room-service/
    session-service/
    realtime/
    rate-limit/
  types/
supabase/
  migrations/
  tests/
tests/
  e2e/
```

Struktur boleh disesuaikan dengan konvensi Next.js yang dipilih, tetapi jangan mencampur engine game, komponen visual, API, dan query database dalam satu file besar.

## 12. UI/UX dan Accessibility

- Desain modern, ramah, jelas, dan mobile-first.
- Kartu game memiliki ilustrasi/placeholder orisinal, kategori, min-max player, durasi, dan badge status playable/coming soon.
- Selalu tampilkan kode room, tombol salin kode, QR, dan jumlah pemain.
- Tampilkan status koneksi/reconnecting dengan jelas.
- Aksi berbahaya seperti reset/leave memiliki konfirmasi yang tepat.
- Hindari tombol yang tampak aktif tetapi belum berfungsi.
- Sediakan loading, empty, error, room penuh, kode salah, sesi kedaluwarsa, dan reconnect states.
- Pastikan tombol dapat digunakan dengan keyboard, focus state terlihat, label input jelas, dan kontras memadai.
- Jangan membuat UI terlalu ramai. Prioritaskan papan bersama dan aksi utama.
- Gunakan Bahasa Indonesia pada UI awal; kode, tipe, dan ID internal memakai nama bahasa Inggris yang konsisten.

## 13. Acceptance Criteria MVP

### Platform dan room

- [ ] Halaman katalog menampilkan tepat dua game sebagai playable dan menjelaskan mode serta jumlah pemain.
- [ ] Pengguna dapat masuk sebagai guest tanpa mengisi email/password.
- [ ] Host dapat membuat online room dan memperoleh kode unik.
- [ ] Pemain lain dapat join lewat kode yang valid dari browser/HP berbeda.
- [ ] Kode salah, room penuh, room kedaluwarsa, dan user yang sudah join ditangani dengan pesan yang jelas.
- [ ] Host dapat memilih host-player atau host-display.
- [ ] Lobby menampilkan pemain dan status ready yang sinkron.
- [ ] Hanya host dapat memulai game, menghentikan room, atau memulai rematch.
- [ ] Host tidak otomatis boleh membaca petunjuk privat pemain.
- [ ] State tetap benar setelah browser refresh dan setelah satu klien reconnect.

### Pass-and-Play

- [ ] Kedua game dapat dimainkan pada satu perangkat.
- [ ] Alur hand-off menyembunyikan petunjuk pemain sebelumnya sebelum memperlihatkan petunjuk berikutnya.
- [ ] Sesi lokal tidak memerlukan koneksi Supabase setelah aplikasi berhasil dimuat, kecuali bila produk memutuskan sebaliknya dan menjelaskannya.

### Game rules

- [ ] Case File memiliki alur kasus lengkap, petunjuk konsisten, tuduhan terbatas, kondisi menang/kalah, dan debrief solusi.
- [ ] Signal Lost memiliki tiga puzzle berurutan, resource/timer, kondisi menang/kalah, dan solusi setelah selesai.
- [ ] Semua aksi ilegal ditolak oleh engine dengan error terstruktur.
- [ ] State privat tiap pemain berbeda sesuai desain dan tidak terkirim ke pemain lain.
- [ ] Semua state transition penting diuji dengan unit tests.

### Keamanan

- [ ] Tidak ada secret/admin key di bundle browser atau variable `NEXT_PUBLIC_*`.
- [ ] RLS aktif untuk tabel yang terekspos; grants dan policies sudah diuji.
- [ ] Browser tidak dapat menulis langsung ke state session, private state, atau event history.
- [ ] API menolak request tanpa autentikasi valid, non-member, role salah, payload invalid, phase salah, dan state version basi.
- [ ] Test membuktikan Player A tidak dapat membaca private clues milik Player B.
- [ ] Test membuktikan Host Display tidak mendapat private clue.
- [ ] Broadcast tidak menyertakan rahasia dan hanya mengirim notifikasi perubahan versi.

### Build dan deployment

- [ ] `npm run lint` lulus.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run test` lulus.
- [ ] `npm run test:e2e` lulus untuk skenario inti jika Playwright sudah dikonfigurasi.
- [ ] `npm run build` lulus.
- [ ] `.env.example`, migration, langkah setup Supabase, dan langkah deploy Vercel tersedia.
- [ ] README menjelaskan keterbatasan guest identity dan setup Realtime/RLS.
- [ ] Tidak ada data/kunci produksi yang di-commit ke Git.

## 14. Rencana Implementasi Bertahap

### Tahap 0: Audit repository dan plan

- Periksa project yang ada sebelum membuat ulang berkas.
- Laporkan stack, struktur, skrip, dan konfigurasi yang sudah tersedia.
- Buat implementation plan, risiko, dan daftar file yang akan dibuat/diubah.
- Jangan overwrite fitur yang ada tanpa alasan.

### Tahap 1: Foundation

- Setup/rapikan Next.js, TypeScript, Tailwind, lint/typecheck/test scripts.
- Buat layout, katalog, desain responsif, manifest game, dan komponen UI dasar.
- Buat kontrak game engine serta registry.
- Buat game runner Pass-and-Play dengan hand-off screen.

### Tahap 2: Game pertama

- Implementasikan Case File engine secara murni dan unit tests lebih dulu.
- Buat satu kasus orisinal yang lengkap.
- Bangun UI dan alur menang/kalah.
- Luluskan seluruh acceptance criteria untuk mode lokal sebelum lanjut.

### Tahap 3: Game kedua

- Implementasikan Signal Lost melalui kontrak engine yang sama.
- Tambahkan tiga puzzle, private fragments, resource, deadline, dan result/debrief.
- Tambahkan unit tests.

### Tahap 4: Backend Supabase

- Buat migration database, indexes, RLS, grants, fungsi atomik untuk state versioning/event history, dan tests.
- Implementasikan anonymous sign-in dan profile guest.
- Implementasikan room, join, lobby, ready, host permission, game session, private state dan rematch.
- Jangan memindahkan semua state game ke browser.

### Tahap 5: Realtime dan keamanan

- Tambahkan private room channel dan Presence bila bermanfaat.
- Broadcast hanya notifikasi `state_changed` dan `version`.
- Client fetch ulang authorized view dari server.
- Tambahkan server-side validation, optimistic concurrency, rate limiting dasar, reconnect, dan expired-room handling.
- Uji akses lintas pemain dan host display.

### Tahap 6: E2E dan hardening

- Playwright: host browser A membuat room, player browser B join, start, action, private clues, finish, reconnect, rematch.
- Jalankan unit tests, database/RLS tests, typecheck, lint, dan production build.
- Selesaikan semua acceptance criteria P0 sebelum memperindah animasi.

### Tahap 7: Deployment

- Siapkan `.env.example` tanpa nilai rahasia.
- Dokumentasikan pembuatan Supabase project, enable anonymous sign-ins, migrations, RLS, Realtime channel policies, dan secrets.
- Deploy dari GitHub ke Vercel.
- Verifikasi production URL dengan dua browser/perangkat berbeda.
- Catat risiko dan tugas lanjutan yang belum selesai.

## 15. Environment Variables

Gunakan nama variabel yang konsisten dengan library dan key format di project. Minimal dokumentasikan:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
# Optional if the Supabase project still uses a legacy server key:
SUPABASE_SERVICE_ROLE_KEY=
# Optional for public production abuse protection:
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Server harus memakai satu jalur admin key yang terkontrol. Jika fallback legacy service role key disediakan, jangan pernah menaruhnya dalam bundle client. Jangan membuat `.env.local` berisi secret dengan nilai palsu yang seolah valid.

---

# Bagian B. Prompt Utama untuk Codex

Salin seluruh prompt di bawah ini ke Codex. Jalankan bertahap. Izinkan Codex menginspeksi repository sebelum mengubah kode.

```text
You are the lead full-stack engineer responsible for building PartyQuest, a deployable MVP for a browser-based multiplayer cooperative game platform.

PRIMARY OBJECTIVE
Build one polished website with a game catalog, guest identity, host-created rooms, room codes and QR sharing, synchronized multiplayer, and a modular game engine. The MVP must include two complete, playable original cooperative games, not a collection of non-functional mockups:
1. Case File: "Kasus di Galeri Senja", a cooperative detective mystery for 2-6 players, target 20-25 minutes.
2. Signal Lost: "Stasiun Relay", a cooperative escape-room puzzle for 2-6 players, target 15-20 minutes.

PRODUCT REQUIREMENTS
- UI language: Bahasa Indonesia.
- Mobile-first responsive web app.
- Guests do not enter email or password. Use Supabase anonymous sign-in for Online Room identity, with the limitations documented. Pass-and-Play sessions can run locally without an online account.
- Support both Pass-and-Play on a single device and Online Room with each player on their own device.
- Online Room supports host as player and a host display-only mode. A display-only device must not receive private clues.
- Host can create a room, choose a game and settings, share the code/QR, start the session, end a room where appropriate, and start a rematch.
- Other players join via room code and can set their display names and ready state.
- Game content, stories, cards, clues, and puzzles must be original. Do not copy commercial game assets, text, names, or proprietary rulebooks.
- A game is complete only when players can start it, finish it in victory or defeat, see a debrief, and replay it.

MANDATORY TECH STACK
- Next.js App Router and TypeScript.
- Tailwind CSS, plus shadcn/ui or accessible equivalents if helpful.
- Supabase PostgreSQL.
- Supabase Auth anonymous sign-in for online guest identity.
- Supabase Realtime Broadcast for state-change notifications and Presence for online indicators when appropriate.
- Zod for all request/action/settings validation.
- Vitest for unit tests and Playwright for end-to-end tests.
- Vercel deployment.
- Use current stable, compatible library versions and current official Supabase/Next.js patterns. Inspect the existing package files before changing dependencies.

CRITICAL WORKING RULES
1. Start by inspecting the repository, package.json, app structure, current code, migrations, and environment configuration. Do not replace a working project blindly.
2. Produce a concise implementation plan with phases and files to create/change before coding. Then implement the plan without waiting for another user message unless a real blocker requires credentials or an irreversible product decision.
3. Work in small, testable milestones. Do not build every game or feature in a single giant component.
4. Do not claim a feature is complete unless it is implemented and tested. Keep a checklist of actual progress.
5. Never commit credentials, tokens, production data, or real environment values.
6. Never put a Supabase secret/admin/service-role key in client code or any NEXT_PUBLIC_ variable.
7. Use accessible components and functional UI states. Do not leave fake buttons or placeholder actions in a feature described as implemented.
8. Avoid `any` as a shortcut. Use strict TypeScript types and discriminated unions where useful.
9. Keep game rules separate from React UI, database persistence, and Realtime transport.
10. After each milestone, run relevant tests, lint, typecheck, and build when practical. Fix failures before continuing.
11. Update README and implementation notes when a feature, migration, security boundary, or setup step changes.
12. Do not stop at a plan. Execute the implementation milestone by milestone in the current task.

REQUIRED MODES
A. Pass-and-Play:
- Use a local game adapter backed by browser state, with optional local persistence for refresh recovery.
- Do not require Supabase connectivity once the app assets are loaded, unless a technical limitation is explicitly documented.
- Before showing a private clue, display a hand-off/privacy screen. Do not show the previous player's clue while the next player is approaching the device.
- Make clear that this is UI privacy only; a shared device cannot cryptographically protect clues from browser inspection.

B. Online Room:
- Use Supabase anonymous identity for each browser/device.
- Host creates a unique, short, case-insensitive room code using an alphabet that avoids ambiguous characters. Enforce uniqueness in PostgreSQL and retry on collision.
- Join by room code; validate room status, expiry, capacity, current user membership, and display name on the server.
- Lobby includes player list, ready state, connection indicator, room code, copy action, and QR.
- The host must not be able to start a game until minimum players are present and all required readiness conditions pass.
- Persist authoritative game state in the database. Refresh/reconnect must recover the correct session and viewer-specific state.
- Support host mode `player` and `display_only`. Keep room ownership separate from a player's right to receive private clues.

MODULAR GAME ENGINE
Design a strongly typed game contract with concepts equivalent to:
- a typed game manifest/registry,
- validateSettings,
- createInitialState,
- createPrivateState per player,
- validateAction,
- applyAction,
- getPlayerView,
- getResult,
- supported modes and player bounds.

The exact names may change if the design improves safety or usability. Every engine should be testable as pure TypeScript without React, Supabase, network, or browser APIs. Implement adapters for local Pass-and-Play and server-authoritative Online Room. Client actions must be action intents, never a full-state replacement. The server must derive the acting user from the authenticated session, not from a user ID supplied in the request.

GAME 1: CASE FILE, "KASUS DI GALERI SENJA"
- 2-6 players, target duration 20-25 minutes.
- Create one original, coherent mystery with suspects, timeline, motive, method, public evidence, private clues, valid solution, and debrief.
- Give players distinct private clues. Each clue must be relevant and the total evidence must support exactly one intended solution.
- Shared board shows public evidence and the currently published clues.
- The team can publish clues, discuss evidence, and submit a shared accusation for culprit, motive, and method.
- Require a minimum number of public clues before accusation and limit the team to two accusations.
- Implement clear win/loss states, an optional hint with an explicit cost or consequence, and a full explanation after the game ends.
- Do not leak the culprit/solution in public state, client bundle data, room events, browser storage for Online Room, or logs before the result is revealed.

GAME 2: SIGNAL LOST, "STASIUN RELAY"
- 2-6 players, target duration 15-20 minutes.
- Create three sequential original puzzles that require players to combine different private fragments.
- Show active puzzle and shared progress on the public board. Keep each player's fragment private in Online Room.
- Incorrect answers consume a limited shared resource. Correct answers unlock the next puzzle.
- Use a server-authoritative start/deadline timestamp for Online Room. The browser may render a countdown but must not decide time expiry.
- Implement win/loss, resource rules, input validation, and a debrief with puzzle solutions.

DATABASE AND MIGRATIONS
Create version-controlled SQL migrations for at least:
1. `guest_profiles`: user_id, display_name, timestamps.
2. `game_rooms`: id, unique room code, host user, game key, status, host mode, capacity, settings JSONB, timestamps, expiry.
3. `room_members`: room/user, display name, role, seat, ready state, timestamps, left_at; constraints/indexes for active membership and unique active seats.
4. `game_sessions`: id, room, round number, status, phase, state_version, public_state JSONB, started_at, deadline_at, finished_at.
5. `game_private_state`: server-only secret engine state, including answer/solution where applicable.
6. `player_private_state`: session and user keyed private state for each player.
7. `game_events`: ordered public event history with unique sequence per session. Never store private clues or the secret answer in public events.

Add useful foreign keys, constraints, indexes, timestamp handling, and cleanup/expiry semantics. Static game metadata can remain in typed code manifests for the MVP.

SECURITY REQUIREMENTS, NON-NEGOTIABLE
- Enable RLS on all tables exposed through Supabase APIs. Review both grants and RLS policies. Revoke unnecessary grants; policies do not automatically remove grants.
- Browser clients may use only the publishable key. Admin/secret key must be server-only.
- Do not expose direct client writes to game_sessions, game_private_state, player_private_state, or game_events. Route writes through authenticated server handlers or carefully permissioned RPCs.
- Use Supabase's current SSR/auth integration correctly for Next.js. Verify user identity from the session on the server for protected mutations.
- Before using an elevated server client, verify identity, room membership, role, room/session status, and permission for the specific action.
- The caller may never choose an arbitrary acting user ID or role through a request payload.
- Public state and private state must be structurally separated. A player's view may include public state plus only that authenticated player's private state.
- Host display-only view must contain no private clue.
- Realtime Broadcast should publish only non-sensitive invalidation notifications such as `{ type: "state_changed", version }`. Do not broadcast full private state, private clues, solution, tokens, or secret payloads. After a notification, clients refetch their authorized view from the server.
- Use private room channels with authorization based on active room membership where applicable. Presence should expose only minimal information such as online status and a safe display name.
- Validate all input with Zod and enforce maximum lengths, valid enums, capacity, current phase, action permissions, rate limits, and allowed transitions server-side.
- Use atomic concurrency control for actions. Each action includes an expected state version. Prevent double actions and stale overwrites. The authoritative state update, version increment, and event insertion must be atomic, preferably through a transaction/RPC/database function. If a version conflict occurs, return a structured conflict and tell the client to refetch.
- Add tests proving Player A cannot read Player B's private state, display-only host cannot read player clues, unregistered/unauthed requests cannot mutate rooms, non-host cannot start, and invalid actions cannot alter state.
- Do not rely on hidden UI or client-side checks as security.
- Add basic server-side rate limiting for room creation and join attempts. Document optional Turnstile/CAPTCHA for public launch to mitigate anonymous sign-in abuse.
- Include an expiry and cleanup approach for stale rooms/sessions. Document that anonymous user records also need a retention/cleanup policy.

REALTIME AND RECONNECT
- Use Supabase Realtime Broadcast for low-volume state-change notifications. Use Presence only for room online indicators if implementation complexity stays reasonable.
- Authoritative state remains in PostgreSQL. Realtime is a signal, not the source of truth.
- On notification, reconnect, or browser focus after disconnect, fetch the latest authorized player view.
- Show a reconnecting status and handle stale state versions gracefully.
- Do not require a persistent WebSocket server on Vercel; use Supabase Realtime for channels.

API REQUIREMENTS
Provide routes or an equivalent well-documented server layer for:
- ensure guest profile,
- create room,
- join room,
- get authorized room/lobby view,
- change ready status,
- start game (host only),
- leave room,
- get authorized session/player view,
- submit game action,
- rematch.

Use a consistent JSON error shape with a safe message and machine-readable error code. Do not return stack traces or secrets to the browser.

UI REQUIREMENTS
- Catalog page with two complete playable game cards, player count, expected duration, category, short instructions, and supported modes.
- Room creation form with game and host mode options.
- Join screen for room code and player name.
- Lobby with player list, ready button, host controls, copy code and QR.
- Shared public board, private clue/card panel, explicit action panel, progress and timer/resource indicators, end-game debrief, rematch.
- Pass-and-Play privacy hand-off flow.
- Host display route that presents only public game state.
- Include loading, error, no-player, room-full, wrong-code, expired-room, disconnected, and rematch states.
- Ensure keyboard access, focus visibility, semantic labels, readable contrast, and touch-friendly controls.
- Do not add decorative animations until core flows work and are tested.

TESTING AND ACCEPTANCE
Create and run:
- Unit tests for every phase and action transition for both game engines, including invalid actions, win/loss conditions, clue visibility rules, timer expiry, and solution/debrief.
- API/integration tests for create/join/start/leave/action/rematch, room capacity and expiration, invalid payloads, unauthorized membership, host-only actions, and stale state versions/concurrent actions.
- Database/RLS tests, ideally pgTAP/Supabase CLI tests, including negative authorization cases.
- Playwright E2E with separate browser contexts representing host and at least two players. Test create room, join, ready, start, synchronize a public action, verify private clues are different and not cross-readable, finish or force end through valid game action, refresh/reconnect, and rematch.
- Pass-and-Play E2E or component tests for hand-off and clue visibility sequencing.
- Use package scripts equivalent to `lint`, `typecheck`, `test`, `test:e2e`, and `build`.

Acceptance is not met until:
- both games can be completed in both supported modes,
- online room works from different browser contexts/devices,
- no private state leaks to another user or display-only host,
- server validates every mutation,
- core tests pass,
- production build passes,
- migrations and deployment steps are documented.

DEPLOYMENT AND DOCUMENTATION
- Provide `.env.example` with variable names only and no real secrets.
- Document Supabase project setup, enabling anonymous sign-ins, applying migrations, configuring RLS and Realtime private-channel authorization, setting environment variables in Vercel, deploying from GitHub, and verifying production with two devices.
- Prefer the current Supabase publishable key for browser use and a secret/admin key only on server. If the project uses a legacy service-role key, keep it server-side and document it as legacy.
- Add a clear README with local setup, tests, migrations, architecture, guest-session limitations, security notes, and deployment.
- Do not claim deployment is complete until a production build and real room test have been performed. If credentials are not available, complete code and provide exact remaining manual setup steps.

IMPLEMENTATION ORDER
Phase 0: inspect repo and provide plan.
Phase 1: setup, design system, catalog, game contract, and Pass-and-Play runner.
Phase 2: implement and test Case File locally.
Phase 3: implement and test Signal Lost locally.
Phase 4: database migrations, guest auth, room and lobby APIs, RLS and DB tests.
Phase 5: server-authoritative online sessions, private player views, atomic version updates, Broadcast notifications, reconnect.
Phase 6: Playwright E2E, security regression tests, accessibility checks, lint, typecheck, build.
Phase 7: deployment documentation and production verification checklist.

Begin by inspecting the repository, then show the implementation plan and start Phase 1. Do not stop after writing a plan or only generating static mockups.
```

---

# Bagian C. Checklist Manual Sebelum Deploy

1. Buat project Supabase dan simpan URL serta publishable key.
2. Aktifkan anonymous sign-ins di Supabase Auth.
3. Review/aktifkan proteksi CAPTCHA atau Turnstile sebelum membuka sign-in guest secara publik.
4. Jalankan migration ke Supabase dan verifikasi RLS/grants.
5. Set environment variables di Vercel. Secret/admin key hanya diset sebagai environment variable server.
6. Deploy dari GitHub.
7. Buka URL production pada dua perangkat atau dua browser profile berbeda.
8. Uji create room, join, ready, start, aksi game, private clues, reconnect, game selesai, dan rematch.
9. Cek bahwa private clue tidak muncul pada response publik, Realtime event, log, atau halaman display.
10. Pastikan `lint`, `typecheck`, unit tests, DB/RLS tests, E2E, dan production build lulus.

# Sumber Teknis Resmi

- Next.js App Router dan instalasi: https://nextjs.org/docs/app/getting-started/installation
- Supabase anonymous sign-ins, keterbatasan guest, dan mitigasi abuse: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Auth dengan Next.js: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase Realtime, pilihan Broadcast/Presence/Postgres Changes: https://supabase.com/docs/guides/realtime/getting_started
- Supabase Row Level Security, grants, dan pengujian: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side
