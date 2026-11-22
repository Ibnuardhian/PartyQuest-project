# PartyQuest

PartyQuest adalah katalog permainan sosial berbahasa Indonesia. Undercover / Tebak Kata adalah game pertama yang tersedia; katalog menandai game mendatang sebagai segera hadir. MVP menyediakan Pass-and-Play pada satu perangkat dan Online Room untuk bermain dari perangkat masing-masing. Online Room memakai PostgreSQL murni (tanpa Supabase).

## Menjalankan dengan Docker

Persyaratan: Docker Desktop dengan engine Linux aktif dan Docker Compose v2.

```powershell
docker compose up --build
```

Buka [http://localhost:3000](http://localhost:3000). Container development memakai Node.js 24 Alpine dan memasang dependency di dalam Docker; Node.js/npm di host tidak diperlukan. Source di-mount untuk hot reload, sedangkan `node_modules` dan cache Next.js disimpan pada named volume. Service `web` menunggu PostgreSQL sehat, menjalankan `npm run db:migrate`, lalu `npm run dev`. Hentikan dengan `Ctrl+C` atau `docker compose down`.

Compose menjalankan PostgreSQL 17 pada `127.0.0.1:5432` (user/database default `partyquest`, password lokal `partyquest_dev_only`). Port hanya terikat ke localhost host. Data disimpan dalam volume `postgres_data`. Jika port 5432 atau 3000 sudah dipakai (atau diblokir Windows), atur `POSTGRES_PORT` dan `WEB_PORT` di `.env`, misalnya `POSTGRES_PORT=55432` dan `WEB_PORT=3100`.

Compose membentuk `DATABASE_URL` dari nilai `POSTGRES_*` dan memakai `GUEST_SESSION_SECRET` dev bawaan bila `.env` kosong. Keduanya diteruskan sebagai environment runtime, bukan build argument, sehingga tidak masuk ke image.

## Konfigurasi

Salin `.env.example` ke `.env` bila perlu mengubah nilai default.

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL untuk server. Wajib untuk Vercel/produksi. |
| `GUEST_SESSION_SECRET` | String acak minimal 32 karakter untuk menandatangani cookie tamu. Hanya server. |
| `DATABASE_POOL_MAX` | Opsional, jumlah koneksi per proses server (default 10). |
| `POSTGRES_*`, `WEB_PORT` | Hanya untuk Compose lokal. |

Jangan memberi prefix `NEXT_PUBLIC_` pada variabel di atas dan jangan commit `.env`.

## Arsitektur Online Room (PostgreSQL)

- **Sesi tamu.** `POST /api/guest/session` membuat baris `guest_users` dan memasang cookie `pq_guest` (HttpOnly, SameSite=Lax, Secure di produksi, 30 hari). Isinya `v1.<uuid>.<issued-at>.<HMAC-SHA256>`, tanpa data game. Server menurunkan identitas pemain hanya dari cookie terverifikasi; browser tidak pernah mengirim user id. Tidak ada email atau kata sandi. Menghapus data browser berarti sesi tamu hilang.
- **Database.** Semua akses melalui modul server-only `src/lib/db/pool.ts` (`pg`). Mutasi memakai fungsi PL/pgSQL (`create_room`, `join_room`, `set_room_ready`, `start_game`, `rematch_room`, `apply_game_action`, `leave_room`) yang mengunci baris dan memvalidasi host, membership, fase, dan jumlah pemain. `apply_game_action` membandingkan `expectedVersion` saat baris sesi dikunci.
- **Privasi.** `game_sessions.public_state`, `game_private_state`, dan `player_private_state` dipisahkan. Endpoint view memverifikasi membership aktif sebelum membaca state privat dan hanya mengembalikan assignment milik pemain itu; semua role terbuka setelah engine mengakhiri permainan.
- **Realtime.** Fungsi mutasi memanggil `pg_notify('partyquest_room_changed', <room id>)`, yang terkirim saat commit. Setiap proses server memiliki satu koneksi `LISTEN` dan meneruskan sinyal ke `GET /api/rooms/<code>/events` (Server-Sent Events) untuk anggota aktif. Event hanya sinyal invalidasi, lalu klien mengambil ulang view yang diotorisasi. Lobi dan game tetap melakukan polling lambat sebagai cadangan.
- **Hak akses.** Migration mencabut hak `PUBLIC` dari tabel dan fungsi. Jalankan aplikasi dengan role pemilik schema atau role khusus aplikasi; jangan membuka database ke klien.

### Migration

`npm run db:migrate` (`scripts/migrate.mjs`) menerapkan `db/migrations/*.sql` berurutan, masing-masing dalam satu transaksi, dicatat di `schema_migrations`, dan dikunci advisory lock agar aman dijalankan bersamaan. Migration `202611220001_initial_undercover.sql` menetapkan masa berlaku room 12 jam dan fungsi `cleanup_expired_rooms()`. Jadwalkan `select cleanup_expired_rooms();` lewat cron atau `pg_cron`. Baris `guest_users` lama tidak dihapus otomatis; atur retensinya sesuai kebutuhan.

## Aturan permainan

1. Masukkan 3–12 pemain, pilih kategori, jumlah Undercover, dan opsi Mr. White.
2. Setiap pemain mengingat kata rahasia. Dalam Pass-and-Play, perangkat diserahkan melalui hand-off; pada Online Room, setiap pemain menerima view privat miliknya.
3. Dalam Pass-and-Play, semua pemain memberi clue dan berdiskusi langsung secara lisan. Satu ronde memiliki timer maksimal 3 menit; aplikasi tidak menyimpan clue atau giliran pemain. Voting juga dilakukan lisan. Setelah sepakat, pemain memilih nama yang tereliminasi di aplikasi dan menekan konfirmasi.
4. Dalam Online Room, clue diberikan bergiliran dengan deadline 3 menit per pemain yang disimpan di state server; refresh tidak mengatur ulang timer, dan giliran yang habis dimajukan oleh server melalui mutasi versi yang sama. Aplikasi tidak merekam isi clue. Voting berlangsung di aplikasi. Seri pada voting pertama diselesaikan dengan satu revote di antara pemain yang seri. Seri kedua tidak mengeliminasi pemain dan memulai ronde petunjuk berikutnya.
5. Kartu Pass-and-Play hanya menampilkan kata, tanpa nama role. Di akhir permainan, hasil menampilkan semua role. Civilian menang setelah semua Undercover dan Mr. White tereliminasi. Undercover menang saat jumlah Undercover aktif menyamai atau melebihi Civilian aktif (Mr. White tidak dihitung). Jika Mr. White tereliminasi, ia mendapat satu tebakan kata Civilian dan menang jika benar.

Pemain dapat keluar dari room saat lobi atau setelah ronde selesai. Membership dipertahankan saat ronde aktif agar giliran tidak tertinggal; buka lagi dengan browser yang sama untuk reconnect.

Pass-and-Play memakai `/games/undercover/local#<hash-sesi>`. ID sesi dan salt acak disimpan bersama state di `sessionStorage`; URL hanya memuat hash SHA-256. Hash ini penanda sesi, bukan token akses. Hand-off hanya privasi melalui UI, bukan perlindungan dari inspeksi browser.

## Perintah proyek

Jalankan perintah di service Docker `web`:

```powershell
docker compose run --rm web npm test
docker compose run --rm web npm run typecheck
docker compose run --rm web npm run lint
docker compose run --rm -e NODE_ENV=production web npm run build
docker compose run --rm web npm run db:migrate
```

Vitest adalah satu-satunya framework test. Test mencakup aturan engine, transisi fase, voting seri, kondisi menang, view privat, adapter Online Room Undercover (aksi palsu, pemain tanpa kursi, deadline server), token sesi tamu, dan test integrasi PostgreSQL (`src/lib/rooms/database.integration.test.ts`) untuk host/ready, nama duplikat, konflik versi, membership, dan NOTIFY. Test integrasi otomatis dilewati bila `DATABASE_URL` tidak ada; di Compose ia memakai database dev dan me-rollback perubahannya.

## Struktur

```
src/
  app/                      route Next.js (halaman tipis + API)
  components/
    catalog/                beranda katalog (membaca registry game)
    lobby/                  lobi Online Room, dipakai semua game
    site/                   header/footer bersama
  games/
    types.ts                kontrak modul UI game (kartu katalog, layar online, label pengaturan)
    online-game.ts          kontrak server game untuk Online Room
    registry.ts             daftar game di katalog
    online-registry.ts      daftar game yang bisa dimainkan online (server)
    undercover/             seluruh logika & UI Undercover
      contract.ts, engine.ts, words.ts, local-session.ts
      server/online.ts      adapter Online Room (settings, aksi, deadline, view)
      ui/                   setup, Pass-and-Play, layar online, kartu katalog, tema CSS
      index.ts              modul game untuk platform
  lib/
    auth/                   cookie tamu bertanda tangan
    db/                     pool pg dan hub LISTEN/NOTIFY
    rooms/                  repository SQL room/sesi, start/rematch, loader sesi
    realtime/               hook SSE di browser
db/migrations/              schema PostgreSQL
scripts/migrate.mjs         runner migration
```

Platform (katalog, lobi, API room, auth, database) tidak berisi aturan game. Untuk menambah game baru:

1. Buat folder `src/games/<game>/` berisi engine, UI, dan `index.ts` yang mengekspor `GameModule`.
2. Daftarkan modul di `src/games/registry.ts`; katalog menampilkan `CatalogCard` milik game.
3. Untuk Online Room, implementasikan `OnlineGameServer` di `src/games/<game>/server/` dan daftarkan di `src/games/online-registry.ts`, lalu izinkan `game_key` baru lewat migration (constraint `game_rooms.game_key`).

## Deploy ke Vercel

1. Siapkan PostgreSQL terkelola, jalankan `npm run db:migrate` dengan `DATABASE_URL` produksi (dari mesin lokal/CI via Docker).
2. Atur `DATABASE_URL` dan `GUEST_SESSION_SECRET` di Vercel.
3. `LISTEN/NOTIFY` memerlukan koneksi langsung atau session pooling; pooler mode transaksi (misalnya PgBouncer transaction mode) tidak meneruskan NOTIFY. Bila hanya tersedia pooler transaksi, Online Room tetap berjalan melalui polling cadangan (15 detik di lobi, 8 detik di game) tetapi lebih lambat.
4. Function serverless memiliki batas durasi; `EventSource` menyambung ulang otomatis setelah stream ditutup.
5. Uji dengan dua browser/perangkat. Build lokal yang berhasil tidak membuktikan deployment bekerja.

## Status pemeriksaan

Diverifikasi di Docker: `npm test` (30 test, termasuk 6 test integrasi PostgreSQL), `typecheck`, `lint`, dan `npm run build`. Smoke test API end-to-end dengan tiga sesi tamu juga dijalankan pada Compose lokal: buat/gabung/siap/mulai, view privat per pemain, penolakan non-host, nama duplikat, konflik versi, aksi palsu, keluar saat ronde berjalan, cookie palsu, dan stream SSE. Uji UI dua perangkat di browser dan deployment Vercel belum diverifikasi.
