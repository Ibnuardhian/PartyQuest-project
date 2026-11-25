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
| `TTS_VOICE` | Opsional. Suara moderator Werewolf: `id-ID-ArdiNeural` (default, sesuai voice pack) atau `id-ID-GadisNeural`. |
| `TTS_CACHE_DIR` | Opsional. Folder cache MP3 (default folder temp OS; Compose memakai volume `tts_cache`). |
| `WEREWOLF_VOICE_PILOT` | Isi `1` untuk mengaktifkan route suara halaman pilot di produksi. |
| `TTS_PROVIDER` | `elevenlabs` (default: voice pack Adam yang sudah di-commit, tanpa API key saat bermain) atau `microsoft`. |
| `ELEVENLABS_API_KEY` | Opsional. Kunci ElevenLabs, hanya server. Jangan commit kunci asli. |
| `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | Opsional. Suara dan model ElevenLabs. |
| `POSTGRES_*`, `WEB_PORT` | Hanya untuk Compose lokal. |

### ONUW satu HP: menentukan pemenang

Di malam hari narator memanggil role sesuai urutan resmi dengan jeda hening 3 detik setelah setiap "… tutup mata" (`ONUW_ROLE_GAP_SECONDS`). Saat pagi, pemain diminta menggesek kartu sambil menutup mata (menyamarkan suara kartu), lalu membuka mata, dan narator memerintahkan berhenti menggesek.

Setelah tunjuk serentak, ketuk pemain yang paling banyak ditunjuk (semua jika seri; tidak memilih berarti tidak ada yang mati, misalnya bila setiap pemain hanya ditunjuk sekali). Lalu semua kartu dibalik dan kartu terakhir tiap pemain dikoreksi di aplikasi, karena Robber, Troublemaker, atau Drunk bisa menukarnya. Hunter yang mati diminta menunjuk satu pemain yang ikut mati. Aturan pemenang ada di `src/games/werewolf/engine/onuw/winner.ts`:
- ada Werewolf di antara pemain: warga menang jika minimal satu Werewolf mati; tim Werewolf (Werewolf + Minion) menang jika tidak ada Werewolf dan tidak ada Tanner yang mati;
- tidak ada Werewolf di antara pemain: warga menang jika tidak ada yang mati atau hanya Minion yang mati; Minion menang jika pemain lain mati;
- Tanner menang jika ia mati, dan kematiannya saja sudah menggagalkan kemenangan tim Werewolf.

### Layar TV Werewolf (opsional)

Host menekan **Hubungkan layar TV** di lobi untuk membuat kode 6 angka (berlaku 10 menit, sekali pakai). TV atau laptop membuka `/games/werewolf/tv`, memasukkan kode room dan kode TV, lalu menerima token acak di cookie HttpOnly (hanya hash SHA-256 yang disimpan, migration `202611230002_tv_screens.sql`). Halaman `/games/werewolf/tv/<kode>` menampilkan fase, hitung mundur, daftar pemain, status voting, hasil voting terbuka, dan pemenang tanpa pernah menampilkan role sebelum permainan selesai. Selama TV aktif (terlihat dalam 30 detik terakhir), suara moderator diputar di TV dan HP host diam.

### Suara moderator Werewolf

Narator bawaan memakai voice pack **ElevenLabs Adam** (`public/audio/werewolf/elevenlabs/`, dengan emosi, pengumuman siang tanpa nama pemain; tidak butuh API key saat bermain). Dengan `TTS_PROVIDER=microsoft` atau pilihan per perangkat, narator memakai **Microsoft Edge Neural TTS** (`id-ID-ArdiNeural`, kecepatan -6%, nada -4Hz) dalam dua bagian:

1. **Voice pack statis.** 41 baris tanpa nama (22 Classic, 19 ONUW) (dari zip voice pack yang sudah dilebur) disimpan sebagai MP3 di `public/audio/werewolf/` dan ikut di-commit, sehingga tidak perlu layanan TTS saat bermain. Naskahnya ada di `src/games/werewolf/voice/voice-pack.json`. Buat ulang dengan `docker compose run --rm --no-deps web npm run voice:generate` (tambahkan `-- --force` untuk menimpa). Script memberi jeda antar-permintaan dan mencoba ulang saat layanan membatasi (HTTP 429). `text` dipakai untuk subtitle dan fallback Web Speech; `edgeText` opsional untuk Microsoft boleh berisi jeda `<break time="1000ms"/>` (node-edge-tts meng-escape SSML, jadi tiap bagian dibacakan terpisah lalu digabung ffmpeg dengan hening sepanjang jeda itu; hanya di image dev); `elevenlabsText` opsional untuk ElevenLabs.
2. **Pengumuman bernama.** Empat pengumuman siang (korban malam, banyak korban, Pemburu, eksekusi) menyebut nama pemain dan dibuat saat dibutuhkan oleh `POST /api/games/werewolf/tts` melalui paket `node-edge-tts` dengan suara yang sama, lalu disimpan di cache disk. Jika gagal, dipakai MP3 umum untuk peristiwa itu, lalu Web Speech API browser.

Giliran malam hanya menyebut nama role agar tidak membocorkan siapa pemegangnya. Route suara hanya membacakan keempat template bernama (`src/games/werewolf/voice/allowed-lines.ts`), hanya untuk host sesi, dan hanya dengan nama pemain di sesi tersebut; `POST /api/games/werewolf/tts/pilot` melayani halaman uji `/games/werewolf/suara` (mati di produksi kecuali `WEREWOLF_VOICE_PILOT=1`).

Layanan ini adalah "Read Aloud" milik Edge, bukan API resmi publik: dapat berubah tanpa pemberitahuan dan penggunaan dari server berada di area abu-abu ketentuan Microsoft. Alternatif resmi dengan suara yang sama adalah Azure Speech.

**Karakter suara dan efek.** `voice-pack.json` berisi preset prosodi Microsoft (`standar`, `berat`, `sangat-berat`, `gelap`; `activePreset` menentukan pack dan baris bernama) dan `dramaticEffects` (gema ruangan, bass tebal, kompresor lewat Web Audio di browser). Edge tidak mendukung gaya emosi untuk suara Indonesia; hanya kecepatan dan nada. Bandingkan di `/games/werewolf/suara`, lalu buat ulang pack dengan `TTS_PRESET=<preset> npm run voice:generate -- --force`.

**Nama role berbahasa Inggris (Microsoft).** Opsi `--bilingual segments` membuat Ardi membaca bahasa Indonesia dan suara Inggris (`bilingual.englishVoice`) membaca nama role, lalu ffmpeg memangkas jeda dan menggabungkannya menjadi satu MP3. `--bilingual multilingual` memakai satu suara multibahasa untuk seluruh kalimat. Sampel pembanding: `npm run voice:generate -- --samples --bilingual segments` (dan `multilingual`), tersimpan di `public/audio/werewolf/samples/` (tidak di-commit). ffmpeg hanya ada di image dev.

**ElevenLabs (opsional).** Isi `ELEVENLABS_API_KEY` di `.env` (opsional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`; default suara premade "Adam" dan model `eleven_v4`). Model `eleven_v3`/`eleven_v4` membaca tag emosi di `elevenlabsText` (misalnya `[sad]`/`[sighs]` saat ada korban, `[evil laugh]` saat Werewolf menang); model lain otomatis mendapat teks tanpa tag. Suara dari Voice Library (misalnya "Eyang") hanya dapat dipakai lewat API dengan paket berbayar; paket gratis mendapat HTTP 402 dan script berhenti tanpa memakai kuota. Kunci hanya dipakai server dan tidak pernah dikirim ke browser. Buat pack ElevenLabs dengan `docker compose run --rm --no-deps web npm run voice:generate -- --provider elevenlabs` (sekitar 3.200 karakter dari kuota akun) ke `public/audio/werewolf/elevenlabs/`, ElevenLabs sudah menjadi penyedia bawaan (`TTS_PROVIDER=elevenlabs`). Baris bernama juga dibuat ElevenLabs (di-cache per baris); jika ElevenLabs gagal, server memakai Microsoft. `GET /api/games/werewolf/voice-config` memberi tahu browser pack mana yang dipakai.

**Pilihan suara per perangkat.** Di `/games/werewolf/suara`, pilih dengan radio button **Microsoft · Ardi** (pengumuman siang menyebut nama pemain) atau **ElevenLabs · Adam** (pack ber-emosi yang sudah di-commit, pengumuman tanpa nama, tidak butuh API key saat bermain), lalu efek dramatis mati/nyala. Tekan **Dengarkan** untuk mencoba dan **Simpan untuk perangkat ini** di HP host atau TV yang menjadi narator. Pilihan disimpan di `localStorage` perangkat itu; tanpa pilihan, dipakai default server (`TTS_PROVIDER`, bawaan ElevenLabs Adam). ElevenLabs hanya memakai suara Adam. Karakter suara dan penutur Microsoft lain ada di bagian "Eksperimen" dan belum berlaku di game.

Jangan memberi prefix `NEXT_PUBLIC_` pada variabel di atas dan jangan commit `.env`.

## Arsitektur Online Room (PostgreSQL)

- **Sesi tamu.** `POST /api/guest/session` membuat baris `guest_users` dan memasang cookie `pq_guest` (HttpOnly, SameSite=Lax, Secure di produksi, 30 hari). Isinya `v1.<uuid>.<issued-at>.<HMAC-SHA256>`, tanpa data game. Server menurunkan identitas pemain hanya dari cookie terverifikasi; browser tidak pernah mengirim user id. Tidak ada email atau kata sandi. Menghapus data browser berarti sesi tamu hilang.
- **Database.** Semua akses melalui modul server-only `src/lib/db/pool.ts` (`pg`). Mutasi memakai fungsi PL/pgSQL (`create_room`, `join_room`, `set_room_ready`, `start_game`, `rematch_room`, `apply_game_action`, `leave_room`) yang mengunci baris dan memvalidasi host, membership, fase, dan jumlah pemain. `apply_game_action` membandingkan `expectedVersion` saat baris sesi dikunci.
- **Privasi.** `game_sessions.public_state`, `game_private_state`, dan `player_private_state` dipisahkan. Endpoint view memverifikasi membership aktif sebelum membaca state privat dan hanya mengembalikan assignment milik pemain itu; semua role terbuka setelah engine mengakhiri permainan.
- **Realtime.** Fungsi mutasi memanggil `pg_notify('partyquest_room_changed', <room id>)`, yang terkirim saat commit. Setiap proses server memiliki satu koneksi `LISTEN` dan meneruskan sinyal ke `GET /api/rooms/<code>/events` (Server-Sent Events) untuk anggota aktif. Event hanya sinyal invalidasi, lalu klien mengambil ulang view yang diotorisasi. Lobi dan game tetap melakukan polling lambat sebagai cadangan.
- **Presence dan pengaturan lobi.** Request lobi dan view memperbarui `last_seen_at`; anggota dianggap online bila terlihat dalam 30 detik terakhir. Host dapat mengubah pengaturan game di lobi lewat `PATCH /api/rooms/<code>/settings` bila modul game menyediakan editor.
- **Hak akses.** Migration mencabut hak `PUBLIC` dari tabel dan fungsi. Jalankan aplikasi dengan role pemilik schema atau role khusus aplikasi; jangan membuka database ke klien.

### Migration

`npm run db:migrate` (`scripts/migrate.mjs`) menerapkan `db/migrations/*.sql` berurutan, masing-masing dalam satu transaksi, dicatat di `schema_migrations`, dan dikunci advisory lock agar aman dijalankan bersamaan. Migration `202611220001_initial_undercover.sql` menetapkan masa berlaku room 12 jam dan fungsi `cleanup_expired_rooms()`. Migration `202611230001_multi_game_rooms.sql` membuka room untuk beberapa game (`undercover`, `werewolf`) hingga 16 pemain, menambahkan `update_room_settings` (pengaturan lobi oleh host), `touch_member` (presence), dan membuat `apply_game_action` dapat menyimpan state rahasia secara atomik. Jadwalkan `select cleanup_expired_rooms();` lewat cron atau `pg_cron`. Baris `guest_users` lama tidak dihapus otomatis; atur retensinya sesuai kebutuhan.

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
    werewolf/docs/          spesifikasi game Werewolf yang sudah diadaptasi ke platform (belum diimplementasikan)
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

## Deploy ke VPS dengan Docker (Hostinger)

`compose.prod.yaml` menjalankan PostgreSQL, migrasi sekali jalan, Next.js standalone (target `runner`), dan menyajikan web di `127.0.0.1:3005` untuk Nginx host (HTTPS ditangani Nginx). Salin `.env.production.example` ke `.env.production` di server, isi rahasianya, lalu jalankan `docker compose -f compose.prod.yaml --env-file .env.production up -d --build`. Langkah lengkap untuk Hostinger VPS, termasuk deploy otomatis dari GitHub Actions (`.github/workflows/deploy.yml`): [deploy/HOSTINGER.md](deploy/HOSTINGER.md).

## Deploy ke Vercel

1. Siapkan PostgreSQL terkelola, jalankan `npm run db:migrate` dengan `DATABASE_URL` produksi (dari mesin lokal/CI via Docker).
2. Atur `DATABASE_URL` dan `GUEST_SESSION_SECRET` di Vercel.
3. `LISTEN/NOTIFY` memerlukan koneksi langsung atau session pooling; pooler mode transaksi (misalnya PgBouncer transaction mode) tidak meneruskan NOTIFY. Bila hanya tersedia pooler transaksi, Online Room tetap berjalan melalui polling cadangan (15 detik di lobi, 8 detik di game) tetapi lebih lambat.
4. Function serverless memiliki batas durasi; `EventSource` menyambung ulang otomatis setelah stream ditutup.
5. Uji dengan dua browser/perangkat. Build lokal yang berhasil tidak membuktikan deployment bekerja.

## Status pemeriksaan

Diverifikasi di Docker: `npm test` (30 test, termasuk 6 test integrasi PostgreSQL), `typecheck`, `lint`, dan `npm run build`. Smoke test API end-to-end dengan tiga sesi tamu juga dijalankan pada Compose lokal: buat/gabung/siap/mulai, view privat per pemain, penolakan non-host, nama duplikat, konflik versi, aksi palsu, keluar saat ronde berjalan, cookie palsu, dan stream SSE. Uji UI dua perangkat di browser dan deployment Vercel belum diverifikasi.

## Atribusi

Ikon role Werewolf (`src/games/werewolf/ui/role-icons.ts`) berasal dari [Game-Icons.net](https://game-icons.net) oleh Lorc, Delapouite, Carl Olsen, dan DarkZaitzev, berlisensi [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Atribusi ditampilkan di bawah daftar role.
