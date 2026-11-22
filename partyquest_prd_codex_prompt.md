# PartyQuest: PRD dan Prompt Codex untuk MVP Undercover

**Status:** Spesifikasi MVP
**Nama produk:** PartyQuest (nama kerja)
**Game MVP:** Undercover / Tebak Kata
**Bahasa UI:** Bahasa Indonesia
**Mode:** Pass-and-Play (satu HP) dan Online Room (HP masing-masing)
**Runtime/deployment:** Docker untuk pengembangan lokal, Vercel untuk deployment web, Supabase untuk backend online
**Engineering tools:** Ponytail dan RTK jika tersedia, tanpa Agency Agents
**Testing:** Unit test bawaan stack saja. Tidak menggunakan Playwright, pgTAP, atau framework test tambahan untuk MVP ini.

---

# Bagian A. Spesifikasi Produk

## 1. Ringkasan

PartyQuest adalah website ringan untuk bermain game sosial bersama teman. MVP hanya perlu menyelesaikan satu game: **Undercover / Tebak Kata**. Prioritasnya adalah permainan yang benar-benar berfungsi, cepat dicoba, mudah dijalankan melalui Docker, dan bisa di-deploy ke Vercel.

Pemain menerima kata rahasia berdasarkan peran. Mayoritas pemain menerima kata yang sama, sedangkan satu atau lebih pemain Undercover menerima kata yang mirip tetapi berbeda. Opsional, satu pemain Mr. White tidak menerima kata sama sekali. Pemain bergiliran memberi petunjuk singkat, berdiskusi, lalu memilih pemain yang dicurigai. Game berlanjut sampai kondisi menang salah satu pihak tercapai.

Konten kata, daftar kategori, pengaturan jumlah Undercover, dan aturan permainan harus orisinal dan dapat diperluas. Jangan menyalin aset atau teks dari game komersial.

## 2. Tujuan MVP

- Homepage sederhana yang menjelaskan game dan mode.
- Pass-and-Play: semua pemain bergiliran menggunakan satu perangkat.
- Online Room: setiap pemain membuka website di perangkatnya sendiri.
- Guest access tanpa registrasi email atau password.
- Host membuat room dan membagikan kode atau tautan.
- Lobby menampilkan pemain dan status siap.
- Pengaturan jumlah pemain, kategori kata, jumlah Undercover, serta opsional Mr. White, dengan validasi batas jumlah pemain.
- Distribusi kata secara rahasia per pemain.
- Fase memberi petunjuk, diskusi, voting, eliminasi, dan pengecekan kondisi menang.
- Hasil ronde, pengungkapan peran/kata, dan main ulang.
- Desain mobile-first yang dapat digunakan di HP dan desktop.
- Docker Compose untuk menjalankan aplikasi secara lokal.
- Deployment Vercel terdokumentasi.
- Unit test bawaan untuk aturan game, validasi, dan pemisahan tampilan privat.

## 3. Batasan MVP

Jangan menambah scope berikut sebelum game inti selesai:

- Katalog banyak game.
- Akun permanen dan profil lintas perangkat.
- Chat teks bebas, voice chat, video, matchmaking publik, leaderboard, statistik jangka panjang, monetisasi, atau editor game.
- Agency Agents atau repository pihak ketiga untuk memasang kumpulan agent.
- Playwright, pgTAP, atau framework testing tambahan.
- Server WebSocket khusus.
- Redis, message broker, microservices, atau arsitektur yang berlebihan untuk game sosial berbasis giliran.
- Animasi kompleks sebelum gameplay, state synchronization, dan keamanan lulus pengujian.

## 4. Peran

- **Host:** membuat room, mengatur game, mengeluarkan kode room, memulai ronde, dan memulai ulang. Dalam mode MVP, host juga menjadi pemain secara default.
- **Player:** bergabung ke room, menerima kata rahasia miliknya, memberi petunjuk, voting, dan melihat hasil.
- **Pass-and-Play player:** pemain lokal yang bergiliran pada satu perangkat.

Mode host display-only terpisah tidak wajib untuk MVP. Jangan membangun mode tambahan kecuali implementasinya hampir tanpa biaya dan tidak mengganggu scope utama.

## 5. Aturan Game Undercover

### 5.1 Konfigurasi default

- Minimal 3 pemain, maksimal 12 pemain.
- Pilihan kategori: makanan, hewan, benda sehari-hari, tempat, pekerjaan, dan campuran.
- Mayoritas menerima kata `civilian` yang sama.
- Undercover menerima kata alternatif yang berkaitan, tetapi tidak sama.
- Opsional Mr. White tidak menerima kata rahasia.
- Host memilih jumlah Undercover dan apakah Mr. White diaktifkan. Server memvalidasi bahwa komposisi peran masih menyisakan mayoritas yang masuk akal.
- Kata dan peran diacak server-side untuk Online Room. Pada Pass-and-Play, pengacakan dilakukan di runtime lokal menggunakan crypto randomness yang tersedia pada browser jika memungkinkan.

### 5.2 Alur ronde

1. **Lobby:** pemain bergabung dan memilih siap.
2. **Pembagian peran:** engine memilih kata berpasangan, mengacak peran, dan menyiapkan private view setiap pemain.
3. **Reveal privat:** tiap pemain membuka kata miliknya secara terpisah. Dalam Pass-and-Play, tampilkan layar hand-off sebelum petunjuk dibuka.
4. **Clue round:** pemain aktif memberi satu petunjuk singkat. Host dapat memilih urutan awal, lalu giliran berlangsung searah jarum jam.
5. **Diskusi:** pemain mendiskusikan petunjuk tanpa menampilkan kata asli.
6. **Voting:** setiap pemain yang masih hidup memilih satu pemain lain. Pemain tidak boleh memilih dirinya sendiri. Untuk MVP, setiap orang hanya dapat mengirim satu suara per fase.
7. **Resolusi voting:** bila satu pemain mendapat suara terbanyak tunggal, pemain itu dieliminasi. Bila seri, jalankan satu revote di antara pemain yang seri. Jika revote tetap seri, ronde berakhir tanpa eliminasi dan permainan melanjutkan clue round atau menyatakan seri sesuai aturan yang dipilih. Pilih dan dokumentasikan satu perilaku yang konsisten.
8. **Mr. White:** jika Mr. White tereliminasi, berikan kesempatan menebak kata Civilian. Jika benar, Mr. White langsung menang; jika salah, lanjutkan pengecekan kondisi menang.
9. **Cek menang:** Civilian menang ketika semua Undercover dan Mr. White dieliminasi. Undercover menang ketika jumlah Undercover yang masih hidup sama dengan atau lebih besar dari jumlah Civilian yang masih hidup, sesuai konfigurasi Mr. White yang dipilih. Definisikan perlakuan Mr. White dengan eksplisit dalam kode dan UI.
10. **Hasil:** ungkap kata dan peran, tampilkan alasan kondisi menang, dan sediakan tombol rematch.

Boleh menyederhanakan aturan imbang untuk mengurangi kompleksitas MVP, tetapi aturan yang dipilih harus konsisten pada engine, UI, dan tests. Jangan membuat aturan penting hanya di frontend.

### 5.3 Informasi publik dan privat

Publik:
- Nama pemain dan status hidup/tereliminasi.
- Fase dan giliran saat ini.
- Petunjuk yang telah disampaikan.
- Status siap, status voting, dan hasil voting setelah fase ditutup.

Privat untuk Online Room:
- Peran setiap pemain.
- Kata rahasia tiap pemain.
- Kata Civilian dan kata Undercover yang belum diungkap.

Petunjuk rahasia tidak boleh dikirim pada initial page payload, data room publik, event Realtime, log, atau response API yang diakses pemain lain. Jangan hanya menyembunyikan informasi memakai CSS atau kondisi React.

Dalam Pass-and-Play, privasi hanya berupa hand-off UI, bukan proteksi terhadap orang yang menginspeksi browser atau mengambil perangkat saat sesi privat terbuka. Jelaskan batasan ini pada dokumentasi.

## 6. Mode Permainan

### 6.1 Pass-and-Play: satu HP

1. Host memilih Pass-and-Play.
2. Masukkan nama 3 sampai 12 pemain dan pengaturan ronde.
3. Game membuat sesi lokal tanpa Supabase Auth dan tanpa room online.
4. Pemain menekan tombol untuk melihat peran/kata secara privat.
5. Setelah selesai, pemain menekan tombol untuk menyembunyikan informasi dan menyerahkan perangkat.
6. Setelah semua pemain selesai, masuk ke clue round.
7. Lakukan clue, diskusi, voting, eliminasi, kondisi menang, dan reveal hasil.
8. Simpan state lokal hanya jika berguna untuk mencegah kehilangan sesi karena refresh. Berikan aksi reset/keluar.

Sesi lokal harus menggunakan engine dan aturan yang sama dengan Online Room. Perbedaan hanya pada adapter persistence dan privasi perangkat bersama.

### 6.2 Online Room: tiap pemain memakai HP sendiri

1. Setiap browser membuat Supabase anonymous session, tanpa email/password.
2. Host membuat room dan memilih pengaturan game.
3. Server menghasilkan kode room yang singkat, acak, case-insensitive, dan menghindari karakter ambigu seperti O/0 dan I/1.
4. Host membagikan kode atau link.
5. Pemain masuk menggunakan kode dan nama tampilan.
6. Lobby menampilkan semua pemain dan status ready.
7. Host dapat mulai saat jumlah pemain cukup dan semua pemain yang diwajibkan sudah ready.
8. Server menetapkan role/kata dan menyimpan state publik serta state privat secara terpisah.
9. Klien fetch authorized view masing-masing. Supabase Realtime Broadcast hanya mengirim pemberitahuan bahwa state berubah, bukan kata/peran.
10. Voting dan semua mutasi divalidasi server-side.
11. Setelah game selesai, semua pemain boleh melihat hasil yang memang sudah diungkap oleh aturan game.
12. Host dapat rematch dengan pengaturan yang sama atau kembali ke halaman awal.

Anonymous identity bukan akun permanen yang dapat dipulihkan lintas perangkat. Sesi dapat hilang ketika data browser dibersihkan. UI/README harus menyatakannya.

## 7. Stack Teknologi

- Next.js App Router + TypeScript.
- Tailwind CSS; gunakan shadcn/ui bila benar-benar membantu dan sesuai dengan project yang sudah ada.
- Supabase PostgreSQL, Auth anonymous sign-in, dan Realtime Broadcast.
- Zod untuk validasi payload API dan konfigurasi game.
- Unit test bawaan stack yang paling sederhana dan sudah tersedia. Jika project baru, gunakan Vitest hanya jika belum ada runner dan dibutuhkan. Jangan menambah Playwright, pgTAP, atau framework test tambahan.
- Dockerfile dan `compose.yaml` untuk menjalankan aplikasi web secara lokal. Supabase boleh menggunakan project hosted untuk MVP; jangan wajibkan menjalankan seluruh Supabase stack di Docker kecuali project lokal yang tersedia memang sudah menggunakannya.
- Vercel untuk deployment web.
- Ponytail dan RTK adalah tool developer opsional. Keduanya bukan dependency aplikasi dan tidak dijalankan di runtime Vercel.

Pilih versi package yang stabil dan kompatibel. Sebelum mengubah dependency, inspeksi repository dan gunakan ulang stack yang sudah berjalan jika masuk akal.

## 8. Arsitektur Game Engine

Pisahkan aturan game dari React UI, Supabase, API, dan transport Realtime. Gunakan registry untuk memudahkan penambahan game di masa depan, tetapi implementasikan hanya Undercover untuk MVP.

Kontrak konseptual:

```ts
interface GameDefinition<PublicState, PrivateState, Action, Settings> {
  key: string;
  minPlayers: number;
  maxPlayers: number;
  validateSettings(input: unknown): Settings;
  createInitialState(context: GameContext, settings: Settings): PublicState;
  createPrivateState(context: GameContext, playerId: string): PrivateState;
  validateAction(context: ActionContext, action: Action): ValidationResult;
  applyAction(
    state: PublicState,
    privateState: PrivateStateMap,
    context: ActionContext,
    action: Action
  ): EngineResult;
  getPlayerView(
    state: PublicState,
    privateState: PrivateState | null,
    viewer: ViewerContext
  ): PlayerView;
  getResult(state: PublicState): GameResult | null;
}
```

Kontrak boleh disesuaikan berdasarkan implementasi TypeScript, tetapi semua entry point harus bertipe dan jangan memakai `any` sebagai jalan pintas.

Prinsip:
- Engine harus deterministik setelah random secret/assignment dibuat, sehingga unit test dapat memeriksa tiap transisi.
- Gunakan random assignment yang aman di sisi server online. Jangan mengandalkan nilai peran/kata yang dikirim browser.
- `getPlayerView` hanya mengembalikan state publik dan private data milik viewer tersebut.
- `applyAction` tidak boleh menerima full state replacement dari browser.
- Pass-and-Play dan Online Room menggunakan aturan yang sama melalui adapter berbeda.
- Game Registry cukup memiliki satu game aktif untuk MVP, tetapi kontraknya memungkinkan game lain ditambahkan kemudian.

## 9. Database MVP

Gunakan migration SQL yang disimpan di repository. Jangan membuat tabel untuk hal yang bisa diselesaikan dengan struktur sederhana.

### `guest_profiles`
- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `game_rooms`
- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `host_user_id uuid not null references auth.users(id)`
- `status text not null`, misalnya `lobby`, `in_progress`, `finished`, `abandoned`
- `settings jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `expires_at timestamptz not null`

### `room_members`
- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references game_rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `display_name text not null`
- `seat_no int not null`
- `is_ready boolean not null default false`
- `is_alive boolean not null default true`
- `joined_at timestamptz not null default now()`
- `last_seen_at timestamptz null`
- `left_at timestamptz null`
- Constraint/index untuk mencegah membership aktif dan seat aktif ganda.

### `game_sessions`
- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references game_rooms(id) on delete cascade`
- `round_no int not null`
- `status text not null`
- `phase text not null`
- `state_version bigint not null default 0`
- `public_state jsonb not null`
- `started_at timestamptz not null default now()`
- `finished_at timestamptz null`
- `created_at timestamptz not null default now()`
- Unique `(room_id, round_no)`.

### `game_private_state`
- `session_id uuid primary key references game_sessions(id) on delete cascade`
- `private_state jsonb not null`
- `updated_at timestamptz not null default now()`
- Menyimpan semua role/word assignment dan jawaban rahasia untuk engine. Akses server-only.

### `player_private_state`
- `session_id uuid not null references game_sessions(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `private_state jsonb not null`
- `updated_at timestamptz not null default now()`
- Primary key `(session_id, user_id)`.
- Tidak boleh dapat dibaca pemain lain melalui Data API atau Realtime.

### `game_events` (opsional jika log event membantu)
- Tambahkan hanya jika memang dibutuhkan untuk state transitions atau diagnosis.
- Event publik tidak boleh menyimpan role/kata privat atau informasi yang membocorkan assignment.

Indeks minimum:
- Unique index pada room code.
- Index `game_rooms(status, expires_at)`.
- Index `room_members(room_id, left_at)`.
- Index `game_sessions(room_id, round_no)`.

Mutasi online yang mengubah state, menaikkan `state_version`, dan menyimpan event terkait harus konsisten dan atomik. Gunakan transaksi atau database function/RPC bila dibutuhkan. Untuk MVP, jangan membuat arsitektur event sourcing penuh.

## 10. Keamanan

- Set RLS untuk tabel yang terekspos melalui Supabase Data API. Review grants dan policies secara bersamaan.
- Browser hanya menggunakan publishable key. Supabase secret/service-role key server-only, tidak pernah diawali `NEXT_PUBLIC_`.
- Semua aksi authoritative diproses melalui server route atau RPC dengan permission yang terkontrol.
- Server mengambil identitas dari authenticated Supabase session, bukan dari `user_id` yang dikirim browser.
- Verifikasi room membership, status game, fase, hak aksi, dan versi state sebelum mutasi.
- Online game state bersumber dari database/server. Klien hanya mengirim action intent.
- Pisahkan `public_state`, `game_private_state`, dan `player_private_state`.
- Endpoint view mengembalikan kata/peran hanya untuk pemain terautentikasi yang berhak melihatnya.
- Broadcast hanya berisi notifikasi seperti `{ "type": "state_changed", "version": 5 }`. Klien fetch authorized view setelah menerima notifikasi.
- Jangan tulis rahasia ke log, response error, query string, analytic event, atau initial public page payload.
- Validasi semua input dengan Zod, batasi panjang nama/payload, cek kapasitas room, dan tambahkan rate limit sederhana pada create/join.
- Tampilkan status reconnect dan fetch ulang state setelah reconnect.
- Dokumentasikan anonymous identity yang tidak dapat dipulihkan seperti akun terdaftar.
- CAPTCHA/Turnstile boleh dicatat sebagai hardening sebelum public launch, tetapi jangan membangun layanan tambahan di luar MVP.

## 11. API yang Disarankan

- `POST /api/guest/ensure-profile`
- `POST /api/rooms`
- `POST /api/rooms/join`
- `GET /api/rooms/[code]`
- `POST /api/rooms/[code]/ready`
- `POST /api/rooms/[code]/start`
- `POST /api/rooms/[code]/leave`
- `GET /api/sessions/[sessionId]/view`
- `POST /api/sessions/[sessionId]/actions`
- `POST /api/rooms/[code]/rematch`

Sesuaikan route dengan konvensi Next.js yang digunakan. Error response harus konsisten, tidak memuat stack trace atau secret. Semua request divalidasi dan setiap mutasi harus memeriksa session, membership, phase, dan concurrency version.

## 12. Struktur Folder Awal

```text
partyquest/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── play/local/page.tsx
│   │   ├── room/new/page.tsx
│   │   ├── room/[code]/page.tsx
│   │   ├── room/[code]/play/page.tsx
│   │   └── api/
│   ├── components/
│   │   ├── lobby/
│   │   ├── game/
│   │   └── shared/
│   ├── games/
│   │   ├── game-contract.ts
│   │   ├── game-registry.ts
│   │   └── undercover/
│   │       ├── manifest.ts
│   │       ├── engine.ts
│   │       ├── schemas.ts
│   │       └── tests/
│   └── lib/
│       ├── auth/
│       ├── supabase/
│       ├── room-service/
│       └── validation/
├── supabase/migrations/
├── Dockerfile
├── compose.yaml
├── .dockerignore
├── .env.example
├── AGENTS.md
├── README.md
└── package.json
```

Gunakan konvensi yang konsisten dengan repository existing. Struktur ini referensi, bukan alasan untuk memindahkan semua kode jika tidak perlu.

## 13. Docker dan Development Lokal

Buat `Dockerfile`, `compose.yaml`, dan `.dockerignore` untuk menjalankan aplikasi Next.js secara lokal lewat Docker. Container web harus membaca konfigurasi dari environment, tidak membundel secret ke image, dan tidak membutuhkan akses Docker socket.

Kebutuhan minimum:
- `docker compose up --build` menjalankan web app pada port yang terdokumentasi.
- Perubahan source dapat dikerjakan dengan alur dev yang wajar. Gunakan target development untuk hot reload jika praktis.
- Berikan `.env.example` dengan nama variabel saja, tanpa secret sungguhan.
- Untuk game online, gunakan Supabase hosted project yang dikonfigurasi manual. Jangan memaksa pengguna menjalankan Supabase lengkap di Docker untuk MVP.
- Jelaskan bahwa mode Pass-and-Play dapat dimainkan tanpa Supabase credentials, sedangkan Online Room memerlukan konfigurasi Supabase.
- Jika aplikasi menggunakan `NEXT_PUBLIC_*`, ingat bahwa nilainya merupakan konfigurasi build/client dan jangan pernah memasukkan service role/secret.
- Uji Docker build dan startup jika Docker tersedia pada environment yang sedang digunakan. Jangan klaim berhasil bila tidak benar-benar dijalankan.

Environment variables yang perlu didokumentasikan sesuai integrasi Supabase yang dipilih:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Gunakan key server yang benar untuk versi project Supabase. Jika project masih menggunakan legacy service role key, nama tersebut boleh dicantumkan sebagai alternatif, tetapi selalu server-only. Jangan mensyaratkan secret key untuk Pass-and-Play.

## 14. Unit Testing

Gunakan hanya unit test bawaan stack. Jangan tambahkan Playwright, pgTAP, atau framework test tambahan untuk MVP ini. Pertama periksa apakah repository sudah memiliki test runner. Jika ada, gunakan yang sudah ada. Jika belum ada, tambahkan hanya satu runner ringan, misalnya Vitest, untuk unit test TypeScript.

Test minimal mencakup:
- Validasi konfigurasi dan jumlah pemain.
- Distribusi peran selalu memenuhi konfigurasi, minimal satu Civilian tersisa, dan kata Undercover berbeda dari kata Civilian.
- Tidak ada assignment yang hilang atau pemain mendapat lebih dari satu role.
- Pengambilan private view hanya mengembalikan kata/peran pemain yang diminta.
- Player tidak dapat memilih dirinya sendiri saat voting.
- Satu pemain tidak dapat mengirim dua vote di fase yang sama.
- Vote seri mengikuti aturan tie-break yang terdokumentasi.
- Eliminasi dan kondisi menang/kalah benar, termasuk Mr. White bila diaktifkan.
- Aksi ditolak jika salah fase, salah pemain, payload invalid, atau state version sudah basi.
- Hasil dan reveal role baru tersedia pada fase yang benar.
- Pass-and-Play menggunakan aturan yang sama dengan Online Room.

Unit test engine tidak menggantikan uji deployment dua perangkat. Untuk MVP, verifikasi online manual menggunakan dua browser atau dua HP dan dokumentasikan checklist manual tersebut. Jangan menyebut pengujian manual sebagai automated E2E test.

Skrip package minimal mengikuti project, umumnya `lint`, `typecheck`, `test`, dan `build`. Jangan tambahkan `test:e2e` bila tidak ada Playwright.

## 15. Acceptance Criteria

### Gameplay
- [ ] Game Undercover bisa selesai dari lobby hingga hasil pada Pass-and-Play.
- [ ] Game Undercover bisa selesai dari lobby hingga hasil pada Online Room dua perangkat.
- [ ] Setiap pemain melihat kata/perannya secara privat sebelum fase clue.
- [ ] Pass-and-Play memiliki hand-off screen dan tidak menampilkan clue pemain sebelumnya saat pemain berikutnya membuka layar.
- [ ] Clue round, voting, eliminasi, tie handling, win/loss, reveal hasil, dan rematch bekerja sesuai aturan yang terdokumentasi.
- [ ] UI menjelaskan aturan Mr. White jika opsi tersebut tersedia.

### Online Room
- [ ] Guest bisa masuk tanpa email/password.
- [ ] Host membuat kode room dan pemain bisa join dari perangkat/browser lain.
- [ ] Lobby menampilkan pemain, ready state, dan jumlah pemain yang benar.
- [ ] Hanya host dapat memulai game dan rematch.
- [ ] Refresh/reconnect memulihkan view pemain yang sesuai.
- [ ] Realtime menyinkronkan perubahan tanpa mengirim private roles/words.

### Security
- [ ] Tidak ada Supabase secret/service-role key di client bundle atau `NEXT_PUBLIC_*`.
- [ ] RLS dan SQL grants telah direview.
- [ ] Pemain A tidak dapat mengambil role/kata milik Pemain B lewat endpoint atau database API.
- [ ] Pengguna yang bukan anggota room tidak dapat membaca sesi privat atau memutasi room.
- [ ] Browser tidak dapat menulis full authoritative game state.
- [ ] Vote ganda, vote sendiri, aksi pada fase yang salah, dan state version conflict ditolak.

### Local run dan deployment
- [ ] `docker compose up --build` bekerja sesuai instruksi jika Docker tersedia untuk pengujian.
- [ ] Pass-and-Play dapat dijalankan tanpa konfigurasi Supabase.
- [ ] Online Room berjalan setelah environment Supabase dikonfigurasi.
- [ ] Unit tests, lint, typecheck, dan production build lulus.
- [ ] README dan `.env.example` tersedia serta akurat.
- [ ] Deploy Vercel terdokumentasi dan checklist uji dua perangkat tersedia.

## 16. Tahapan Implementasi

### Tahap 0: Audit
- Inspeksi repository, status Git, package files, implementasi existing, scripts, dan `AGENTS.md`.
- Identifikasi runtime Codex saat ini (cloud, CLI, atau IDE).
- Cek apakah Ponytail dan RTK sudah terpasang dan aktif. Jangan memasang otomatis tanpa izin/environment yang mendukung.
- Hapus asumsi dua game dari prompt lama; produk MVP sekarang hanya Undercover.
- Buat plan singkat lalu mulai implementasi, jangan berhenti setelah membuat plan.

### Tahap 1: Gameplay lokal
- Buat game contract, registry, aturan Undercover, kata berpasangan, role assignment, clue turn, voting, tie resolution, kondisi menang, reveal hasil, dan rematch.
- Implementasikan Pass-and-Play dulu.
- Tambahkan unit test untuk rules dan private view.

### Tahap 2: Online foundation
- Tambahkan Supabase SSR/Auth anonymous dan profile guest.
- Buat migrations, RLS, grants, room creation/join, lobby, ready, dan host validation.
- Pisahkan state publik, private game state, dan private player state.

### Tahap 3: Online gameplay
- Tambahkan server-authoritative actions, atomic version checks, view per pemain, Broadcast notification, reconnect, voting, dan rematch.
- Pastikan data rahasia tidak ikut pada public room fetch, Broadcast, log, atau bundle.

### Tahap 4: Docker dan dokumentasi
- Buat Dockerfile, Compose, `.dockerignore`, `.env.example`, README, dan root `AGENTS.md`.
- Uji docker build/start jika tersedia.
- Jalankan unit tests, lint, typecheck, dan production build.

### Tahap 5: Manual verification dan deploy
- Gunakan dua browser profile atau dua HP untuk uji online manual.
- Uji Pass-and-Play, room creation, join, ready/start, reveal privat, clue round, voting, eliminasi, hasil, reconnect, dan rematch.
- Siapkan deployment Vercel dan Supabase.
- Catat hasil pemeriksaan yang benar-benar dijalankan dan semua konfigurasi manual yang tersisa.

## 17. Dokumentasi yang Wajib Dijaga

Codex harus membuat atau menggabungkan root `AGENTS.md`, bukan menimpa instruksi repository existing secara membabi buta. Perbarui README dan `AGENTS.md` saat arsitektur, scripts, security boundaries, migration, setup, tool workflow, atau aturan engineering berubah. Tidak perlu mengubah `AGENTS.md` pada setiap edit kecil yang tidak mengubah konteks permanen.

---

# Bagian B. Prompt Utama untuk Codex

Salin prompt di bawah ini ke Codex setelah membuka repository yang akan dipakai.

```text
You are the lead full-stack engineer building PartyQuest, a small deployable MVP for the Undercover / word-guessing party game.

PRODUCT SCOPE
- Implement one game only: Undercover / Tebak Kata.
- Support Pass-and-Play on one shared phone and Online Room where each player uses their own phone/browser.
- Guests do not register with email/password.
- UI language is Bahasa Indonesia.
- Target session length is around 15-30 minutes.
- The app must run locally with Docker Compose and be deployable to Vercel with Supabase for online play.
- Do not use or install Agency Agents or any repository for bulk agent prompts. Do not create subagents or install collections of agent prompts. Keep token usage and tooling overhead low.
- Use the existing built-in/unit-test setup only. Do not add Playwright, pgTAP, or other dedicated test frameworks. If the repository has no unit-test runner, add at most one lightweight runner such as Vitest.

TECH STACK
- Next.js App Router and TypeScript.
- Tailwind CSS; reuse existing UI components first.
- Supabase PostgreSQL, anonymous Auth for online guest identity, and Realtime Broadcast for notifications.
- Zod for input validation.
- Existing unit test runner, or one lightweight unit-test runner if none exists.
- Dockerfile, compose.yaml, and .dockerignore.
- Vercel deployment.
- Ponytail and RTK are optional developer tools only, not runtime dependencies.

STEP 0: INSPECT BEFORE MODIFYING
1. Inspect repository status, structure, package scripts, current dependencies, existing app behavior, Docker files, environment configuration, tests, and AGENTS.md.
2. Do not replace a working repository blindly.
3. Detect the active Codex environment (web/cloud, CLI, or IDE) and whether Ponytail and RTK are actually installed/configured.
4. Give a concise implementation plan, then proceed to implement it in small milestones without waiting for another prompt unless blocked by a real missing credential or irreversible decision.
5. Keep the final report factual: list commands actually run, results, what was not tested, blockers, and manual setup still needed.

PONYTAIL AND RTK
- Ponytail official repository: https://github.com/DietrichGebert/ponytail
- RTK official repository: https://github.com/rtk-ai/rtk
- First check availability and existing setup. Do not assume a local machine setup exists in a Codex cloud session.
- If Ponytail is already installed and supported, follow the installed plugin instructions and use available review hooks/commands. Otherwise apply its principles manually: minimal changes, reuse existing patterns, validate inputs, review affected logic, and test important branches. Never claim the plugin ran if it did not.
- If `rtk --version` works and its Codex integration is configured, use RTK for shell output filtering. If it is missing, continue normally with concise commands/output. Do not install globally or edit global config unless the environment permits it and the installation is necessary and approved.
- Never add Ponytail or RTK to application dependencies, Docker runtime layers, or Vercel production dependencies.
- Do not use the Agency Agents project, its scripts, its generated agents, or equivalent bulk agent installation.

UNDERCOVER RULES
- Support 3-12 players, adjusting the upper bound only if the existing architecture or product decision requires it.
- Majority players are Civilians and share one secret word.
- Undercover players receive a related but different word.
- Optional Mr. White receives no word. Make this option explicit in game settings and rules.
- Host chooses category, Undercover count, and whether Mr. White is enabled. Validate the combination server-side.
- Phases: lobby, private reveal, clue round, discussion, voting, optional revote for ties, elimination, win-condition evaluation, result/debrief, rematch.
- No player may vote for themselves or submit more than one vote per phase.
- Define tie behavior once and test it.
- If Mr. White is eliminated, allow one guess at the Civilian word. A correct guess wins immediately; otherwise evaluate normal win conditions.
- Civilians win when all opposing roles are eliminated. Undercover win condition must be implemented consistently and documented, including how Mr. White affects the count.
- Use original word pairs and categories. Do not copy proprietary assets or card content.

REQUIRED MODES
A. Pass-and-Play:
- Work from local state without Supabase credentials.
- Ask for player names and game options.
- Before each role/word reveal, show a hand-off privacy screen.
- Hide the previous player's word before the next reveal.
- Use the same game engine/rules as Online Room.
- Document that hand-off UI is not cryptographic protection from someone inspecting the shared device/browser.

B. Online Room:
- Use Supabase anonymous sign-in. Do not ask for email/password.
- Host creates a short, unique, case-insensitive room code using characters that avoid ambiguity; enforce uniqueness in the database and retry collisions.
- Players join via code, set a display name, and ready up.
- Host can start only when valid player-count/readiness conditions pass.
- Server assigns roles and words. Store public state separately from secret engine state and per-player private state.
- Each authenticated player may fetch only their own role/word and public game state.
- Voting and all authoritative transitions are validated on the server.
- Realtime Broadcast messages contain only non-sensitive invalidation notifications such as `{ type: "state_changed", version: 5 }`. Clients then fetch their authorized view.
- Reconnect/refresh should recover the correct public and player-private view.
- Host/player permission must not grant access to every player's secret data.

MODULAR ENGINE
- Implement a small typed game contract and `game-registry`; only register Undercover for MVP.
- Separate engine logic from React, persistence, Supabase, and Realtime.
- Provide typed functions equivalent to `validateSettings`, `createInitialState`, `createPrivateState`, `validateAction`, `applyAction`, `getPlayerView`, and `getResult`.
- Keep action inputs as intents. Never accept authoritative full-state replacement from the browser.
- Use strict TypeScript and avoid `any`.
- Use expected `state_version` on online mutations. Reject stale versions without overwriting newer state.

DATABASE
Create SQL migrations for:
- `guest_profiles`.
- `game_rooms` with unique code, host, status, settings, expiry.
- `room_members` with user, room, display name, seat, ready/alive flags, and leave timestamps.
- `game_sessions` with phase, status, state_version, public_state, timestamps.
- `game_private_state` for role/word assignments and game secrets; server-only.
- `player_private_state` keyed by session and user, storing that player's role/word; other users must not be able to read it.
Add necessary foreign keys, constraints, indexes, expiry semantics, and migrations. Do not build full event sourcing. Add an event table only if a clear MVP requirement justifies it and never place secret information in public events.

SECURITY REQUIREMENTS
- Enable and test RLS on tables exposed via Supabase APIs. Review SQL grants and RLS together.
- Publishable key only in browser. Secret/service-role key server-only; never use `NEXT_PUBLIC_` for a secret.
- Validate user identity from the authenticated server session, not from a submitted user ID.
- Check room membership, host privileges, game phase, valid action, and version before every mutation.
- Prevent browser writes to authoritative session/private-state tables.
- Public state must not contain private words/roles before the game is over.
- Do not leak secrets through HTML/initial page payloads, Realtime, logs, error messages, query strings, or analytics.
- Validate API payloads with Zod; limit names, room creation/join attempts, player count, and action frequency.
- Document anonymous identity limitations and optional CAPTCHA/Turnstile before public launch.

DOCKER
- Provide Dockerfile, compose.yaml, .dockerignore, and .env.example.
- `docker compose up --build` should start the web app on a documented local port when Docker is available.
- Keep secrets out of image layers and build output.
- Document that Pass-and-Play can work without Supabase configuration and Online Room requires Supabase environment values.
- Use hosted Supabase for the MVP unless the existing project already uses a local Supabase Docker stack. Do not add Dockerized Supabase services just for appearance.
- Run Docker build/start checks if Docker exists in the active environment; otherwise say the check could not be run.

UNIT TESTING ONLY
- Reuse the existing unit-test runner. If none exists, add at most one lightweight runner such as Vitest.
- Do not install Playwright, pgTAP, or another testing framework.
- Unit test configuration bounds, role assignment, word-pair mismatch, private-view isolation, valid phases, clue turns, vote validation, duplicate votes, self-votes, tie behavior, eliminations, Mr. White guess, win/loss, result reveal, and stale state versions.
- Manually verify the online room with two browser profiles/devices. Document this checklist; do not call it automated E2E.
- Provide scripts appropriate for the current project, typically `lint`, `typecheck`, `test`, and `build`. Do not add `test:e2e`.

DOCUMENTATION
- Create/update README with local setup, Docker commands, Supabase setup, migrations, environment variables, game rules, guest limitations, security notes, and Vercel deployment.
- Create/update root AGENTS.md. Read existing instructions and merge instead of blindly overwriting.
- Update AGENTS.md when lasting architecture, test commands, tool workflow, security invariants, or development rules change. Update README when setup, schema, behavior, or deployment changes.
- `.env.example` contains variable names only, never actual secrets.

IMPLEMENTATION PHASES
1. Audit repository and tooling, write plan, preserve working code.
2. Implement typed engine and Pass-and-Play; add unit tests and finish a complete local round.
3. Add Supabase migrations, anonymous identity, room creation/join, lobby and ready/start rules.
4. Add private role/word delivery, server-authoritative actions/voting, Realtime notifications, reconnect, and rematch.
5. Add Docker assets, README, AGENTS.md, and env example.
6. Run unit tests, lint, typecheck, production build, and Docker checks if available. Conduct manual two-device verification if the configured Supabase project is available.
7. Prepare Vercel deployment instructions. Do not claim deployment or live multiplayer is verified unless actually tested.

ACCEPTANCE CRITERIA
- One complete Undercover game works in Pass-and-Play and Online Room.
- Online gameplay works across separate browser contexts/devices when Supabase is configured.
- Each player sees only their own word/role before end-game reveal.
- Host cannot read other players' private state through API/Data API.
- Clues, voting, tie behavior, elimination, win/loss, result reveal, and rematch follow tested rules.
- Docker run/build works if Docker is available and the commands are documented.
- Unit tests, lint, typecheck, and production build pass, or failures/skipped checks are clearly reported.
- README, AGENTS.md, migrations, and .env.example exist and are accurate.

Start by inspecting the repository. After the concise plan, proceed with implementation. Do not stop at a plan or static UI mockup.
```

---

# Bagian C. Checklist Manual Sebelum Deploy

1. Buat project Supabase dan salin URL serta publishable key ke environment lokal.
2. Aktifkan anonymous sign-in di Supabase Auth.
3. Jalankan migration dan periksa grants serta RLS.
4. Jalankan `docker compose up --build` untuk mencoba app lokal.
5. Uji Pass-and-Play tanpa Supabase credentials.
6. Uji Online Room memakai dua browser profile atau dua HP.
7. Pastikan tiap pemain hanya melihat kata/perannya sendiri sebelum reveal hasil.
8. Uji clue round, voting, vote seri, eliminasi, Mr. White (jika aktif), win/loss, dan rematch.
9. Jalankan unit tests, lint, typecheck, dan production build.
10. Set environment variables di Vercel. Jangan pernah memasukkan secret key ke variable `NEXT_PUBLIC_*`.
11. Deploy dan uji ulang URL production pada dua perangkat.
12. Catat tool yang benar-benar aktif: Ponytail, RTK, atau tidak keduanya. Jangan klaim tool berhasil diaktifkan tanpa verifikasi.

# Sumber Teknis

- Next.js: https://nextjs.org/docs/app
- Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Next.js Auth: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase Realtime: https://supabase.com/docs/guides/realtime/getting_started
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side
- Docker Compose: https://docs.docker.com/compose/
- Ponytail: https://github.com/DietrichGebert/ponytail
- RTK: https://github.com/rtk-ai/rtk

---

# Bagian D. Template `AGENTS.md`

Gunakan sebagai dasar saat membuat atau memperbarui `AGENTS.md` di repository. Jika sudah ada, baca dan gabungkan instruksi yang relevan.

```markdown
# PartyQuest Repository Instructions

## Product and stack
- MVP is one original Undercover / word-guessing game.
- Modes: Pass-and-Play on one device and Online Room on separate devices.
- Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Realtime, Docker, and Vercel.
- UI language is Bahasa Indonesia.
- Do not use/install the Agency Agents repository or create subagents for this MVP.

## Engineering
- Inspect existing files and reuse working patterns before adding dependencies.
- Prefer the smallest solution that satisfies requirements. Do not remove needed validation or security to save tokens.
- Keep game rules independent from React, Supabase, and transport adapters.
- Use strict TypeScript and avoid `any`.
- Do not claim features or checks work without evidence from commands actually run.
- Use the existing unit-test runner. If none exists, add at most one lightweight runner. Do not add Playwright or pgTAP for this MVP.

## Security invariants
- Server/database is authoritative for Online Room.
- Derive identity from the authenticated session, not from a request-supplied user ID.
- Keep public state, secret game state, and per-player private state structurally separate.
- A player can only receive their own word/role until end-game reveal.
- Never include secret words/roles in Realtime notifications, public page payloads, logs, or error responses.
- Keep Supabase secret/service-role keys server-only; review RLS policies and SQL grants together.
- Validate every mutation and use version checks to avoid stale writes.

## Tooling
- Ponytail: check whether the official tool is installed and supported. If unavailable, apply its minimal-change and review principles manually. Never claim it ran when it did not.
- RTK: use only if installed and its Codex integration is verified. It is developer tooling, not an app dependency. Otherwise keep terminal output concise.
- Do not install or use Agency Agents or bulk agent-prompt repositories.
- Do not assume local CLI/global configuration persists in Codex cloud.

## Required workflow
1. Inspect repository status, current instructions, scripts, dependencies, tests, and environment configuration.
2. Write a concise plan and implement in small, testable milestones.
3. Run unit tests, lint, typecheck, build, and Docker checks where available.
4. Manually verify multiplayer using two browser profiles/devices if Supabase is configured. Do not call manual testing automated E2E.
5. Update this file when architecture, scripts, tool status, security invariants, or working rules change.
6. Update README when setup, schema, behavior, or deployment steps change.
7. Report actual test commands/results, skipped checks, limitations, and remaining manual steps.
```
