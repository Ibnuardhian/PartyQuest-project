# PartyQuest

PartyQuest adalah katalog permainan sosial berbahasa Indonesia. Undercover / Tebak Kata adalah game pertama yang tersedia; katalog menandai game mendatang sebagai segera hadir. MVP menyediakan Pass-and-Play pada satu perangkat dan Online Room untuk bermain dari perangkat masing-masing.

## Menjalankan dengan Docker

Persyaratan: Docker Desktop dengan engine Linux aktif dan Docker Compose v2.

```powershell
docker compose up --build
```

Buka [http://localhost:3000](http://localhost:3000). Container development memakai Node.js 24 Alpine dan memasang dependency proyek di dalam Docker. Source di-mount untuk hot reload, sedangkan `node_modules` dan cache Next.js disimpan pada named volume. Node.js/npm di host tidak diperlukan. Untuk menghentikan server tekan `Ctrl+C`, atau jalankan `docker compose down`.

Compose juga menjalankan PostgreSQL 17 untuk development pada `127.0.0.1:5432` (user/database default `partyquest`, password default lokal `partyquest_dev_only`). Atur `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` di `.env` bila perlu; gunakan password lokal sendiri jika dibutuhkan. Port hanya terikat ke localhost host agar dapat dipakai melalui port forwarding tanpa dibuka ke jaringan publik. Data disimpan dalam volume `postgres_data`.

Setelah memulai Pass-and-Play, URL menjadi `/games/undercover/local#<hash-sesi>`. ID sesi dan salt acak disimpan bersama state di `sessionStorage`; URL hanya memuat hash SHA-256 dari ID dan salt. Hash ini menjadi penanda sesi, bukan pengaman atau token akses. State (termasuk kata dan peran) dipulihkan setelah refresh pada tab yang sama, dan sesi lama dimigrasikan otomatis. Menutup tab mengakhiri penyimpanan sesi lokal.

Pass-and-Play bekerja tanpa Supabase. Pilih **Online Room** untuk mengganti kartu setup kanan dari form lokal ke form buat/gabung room; tema Noir tetap dipakai. Untuk menjalankan operasi room aplikasi, salin `.env.example` ke `.env`, isi nilai dari proyek Supabase, lalu jalankan ulang Compose. Online Room memakai Supabase Auth, PostgreSQL, dan Realtime melalui API Supabase. Container PostgreSQL lokal disediakan untuk development dan port-forward testing, tetapi bukan pengganti Auth/Realtime Supabase dan belum menjadi backend room aplikasi. Compose meneruskan secret Supabase sebagai environment runtime container; secret tidak ditambahkan ke image.

## Menyiapkan Supabase Online Room

1. Buat proyek Supabase dan salin Project URL, publishable key, serta secret key server ke `.env`.
2. Aktifkan **Anonymous Sign-Ins** di Supabase Auth. Guest tidak memakai email atau kata sandi; sesi guest tidak dapat dipulihkan setelah data browser dihapus atau pengguna berpindah perangkat.
3. Terapkan migration `supabase/migrations/202610220001_initial_undercover.sql` melalui Supabase CLI atau SQL Editor.
4. Periksa kebijakan RLS dan grants setelah migration diterapkan. Tabel aplikasi menolak akses langsung `anon` dan `authenticated`; mutasi menggunakan route server setelah memverifikasi guest, membership, dan peran host.
5. Kebijakan pada `realtime.messages` mengizinkan anggota aktif menerima broadcast private room. Broadcast hanya membawa notifikasi perubahan dan versi; klien mengambil ulang view yang diotorisasi.
6. Uji create/join/ready/start, pembagian kata, clue, voting, hasil, reconnect, dan rematch menggunakan dua browser profile atau perangkat.

Pemain dapat keluar dari room saat lobi atau setelah ronde selesai. Membership dipertahankan saat ronde aktif agar giliran tidak tertinggal; tutup browser untuk disconnect sementara, lalu buka lagi dengan sesi guest yang sama untuk reconnect.

Migration menyediakan `cleanup_expired_rooms()` untuk menghapus room yang melewati masa berlaku 12 jam. Jadwalkan pemanggilan fungsi ini menggunakan Supabase Cron atau operasi maintenance server. Kebijakan retensi untuk anonymous Auth users harus diatur terpisah di proyek Supabase.

Contoh variabel untuk `.env` dan Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` hanya untuk server. Jangan mengganti namanya menjadi `NEXT_PUBLIC_*` atau mengirimkannya ke browser. Jangan membuat key nyata di image Docker atau commit `.env`.

## Aturan permainan

1. Masukkan 3–12 pemain, pilih kategori, jumlah Undercover, dan opsi Mr. White.
2. Setiap pemain mengingat kata rahasia. Dalam Pass-and-Play, perangkat diserahkan melalui hand-off; pada Online Room, setiap pemain menerima view privat miliknya.
3. Dalam Pass-and-Play, semua pemain memberi clue dan berdiskusi langsung secara lisan. Satu ronde memiliki timer maksimal 3 menit; aplikasi tidak menyimpan clue atau giliran pemain. Voting juga dilakukan lisan di luar aplikasi. Setelah sepakat, pemain memilih nama yang tereliminasi di aplikasi dan menekan konfirmasi.
4. Dalam Online Room, clue diberikan bergiliran dengan deadline 3 menit per pemain yang disimpan di state server; refresh tidak mengatur ulang timer. Aplikasi tidak merekam isi clue. Voting berlangsung di aplikasi. Seri pada voting pertama diselesaikan dengan satu revote di antara pemain yang seri. Seri kedua tidak mengeliminasi pemain dan memulai ronde petunjuk berikutnya.
5. Kartu Pass-and-Play hanya menampilkan kata, tidak menampilkan nama role. Pemain harus menjaga kerahasiaan kata dan kartu. Di akhir permainan, hasil menampilkan semua role. Civilian menang setelah semua Undercover dan Mr. White tereliminasi. Undercover menang saat jumlah Undercover aktif menyamai atau melebihi Civilian aktif. Jika Mr. White tereliminasi, ia mendapat satu tebakan kata Civilian dan menang jika benar.

Dalam Pass-and-Play, hand-off hanya privasi melalui UI. Informasi tidak terlindungi dari inspeksi browser atau orang yang melihat perangkat saat kartu masih terbuka.

## Perintah proyek

Jalankan perintah di service Docker `web`:

```powershell
docker compose run --rm web npm test
docker compose run --rm web npm run typecheck
docker compose run --rm web npm run lint
docker compose run --rm -e NODE_ENV=production web npm run build
```

Vitest adalah satu-satunya framework test. Tidak ada Playwright atau pgTAP. Test saat ini mencakup aturan engine, transisi fase, voting seri, kondisi menang, validasi input, dan view privat. Verifikasi RLS dan uji dua perangkat perlu dilakukan pada proyek Supabase yang sudah dikonfigurasi.

## Struktur dan keamanan

- `src/games/undercover/engine.ts` berisi aturan yang dipakai kedua mode.
- `src/games/game-contract.ts` mendefinisikan game state, action intent, dan player view bertipe.
- `src/components/game/partyquest-home.tsx` menampilkan katalog dan runner Pass-and-Play; `/games/undercover/local` adalah URL game lokal.
- `src/games/undercover/local-session.ts` memvalidasi sesi Pass-and-Play, membuat ID dan salt acak, menghitung hash SHA-256 untuk fragment URL, dan menyimpan state di `sessionStorage` tab.
- `src/app/api` memverifikasi anonymous guest session sebelum mengakses Supabase.
- `game_sessions.public_state`, `game_private_state`, dan `player_private_state` dipisahkan di database.
- Service key hanya digunakan dalam modul server-only. Browser mengirim action intent dan `expectedVersion`; RPC membandingkan versi secara atomik sebelum menyimpan perubahan.
- Broadcast Realtime tidak membawa role, kata, suara pemain, atau state permainan.

## Deploy ke Vercel

Hubungkan repository ke Vercel dan atur tiga environment variable di atas untuk environment yang dibutuhkan. Jalankan migration di Supabase sebelum mengaktifkan Online Room, lalu uji dengan dua browser/perangkat. Build lokal yang berhasil tidak membuktikan deployment atau room online bekerja.

## Status tooling dan pemeriksaan

Docker CLI dan Compose aktif. RTK `0.50.0` terpasang di host; integrasi Codex tidak diverifikasi. Ponytail tidak tersedia di tool Codex yang terdeteksi, sehingga perubahan ditinjau manual. Integrasi dan kelengkapan Online Room belum diverifikasi menggunakan kredensial Supabase. NPM audit melaporkan lima alert berkeparahan tinggi yang semuanya berasal dari satu advisori pada paket development `braces@3.0.3` melalui ESLint; advisory menyebut belum ada versi patched upstream saat ini. Production dependency audit melaporkan nol temuan.
