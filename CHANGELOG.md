# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/).

## [Belum dirilis] — branch `werewolf-game` (2026-11-23)

### Belum selesai / perlu keputusan

- [ ] **Uji langsung multi-perangkat** (Fase 7.2): Werewolf Classic, ONUW, dan layar TV belum dicoba dengan beberapa HP dan TV sungguhan di browser. Semua aturan, API, halaman, dan image produksi sudah diuji otomatis atau lewat smoke test.
- [ ] **Karakter suara Microsoft dan pelafalan nama role** di game masih `standar` dan Ardi untuk semua kata; keduanya hanya bisa dicoba di bagian "Eksperimen" halaman suara. Menggantinya di game perlu membuat ulang voice pack.
- [ ] **Lisensi ElevenLabs paket gratis**: periksa ketentuan ElevenLabs (atribusi/penggunaan komersial) sebelum merilis audio Adam yang dibuat dengan paket gratis.
- [ ] **Layar TV**: TV hanya membaca (fase dimajukan oleh request pemain, bukan TV).
- [ ] **Deploy ke VPS Hostinger** belum dilakukan (stack produksi sudah diuji lokal). **Deploy Vercel** belum diverifikasi: cache TTS di Vercel hanya `/tmp` (sementara), dan layanan Edge TTS dari Vercel belum dicoba. `LISTEN/NOTIFY` butuh koneksi Postgres langsung atau session pooling.
- [ ] **Cache TTS di disk** belum punya kebijakan pembersihan otomatis. Rate limit route TTS sudah ada, tetapi per proses server (tiap instance serverless punya batasnya sendiri).

### Ditambahkan

- **Katalog seragam**: satu komponen `GameCatalogCard` untuk Undercover, Werewolf, dan kartu "segera hadir" (sudut, tinggi, tipografi, tombol, dan footer sejajar; pill jumlah pemain berikon; hover mengangkat kartu dan mengisi tombol dengan aksen). Motif tiap game tetap dipertahankan di banner; Undercover memakai aksen mawar `#E11D48`, Werewolf `#38BDF8`.
- **GitHub Actions** (`.github/workflows/deploy.yml`): setiap push ke `main` diverifikasi (migrasi, typecheck, lint, test termasuk integrasi PostgreSQL, build image), lalu commit yang sama dideploy ke VPS lewat SSH dan Docker Compose dengan health check. Deploy aktif setelah variabel `DEPLOY_ENABLED=true` dan secret VPS diisi (panduan di `deploy/HOSTINGER.md`).
- **Kit UI game** (`src/components/ui/game-ui.tsx`) dengan token `--game-accent` dan tiga tingkat permukaan: kartu terangkat, input terisi, tombol utama solid aksen, tombol sekunder solid, tile counter role dengan titik kubu dan stepper 36 px, slider bertema dengan nilai dalam pill, dan banner validasi. Dipakai di halaman setup Werewolf, layar "Atur deck" ONUW (2 kolom di desktop, 1 di ponsel), dan editor komposisi role di lobi.
- **Halaman setup Werewolf dan Undercover**: tombol "Main ONUW" tidak lagi menimpa teks; kartu kanan memakai permukaan terangkat, input terisi dengan fokus cyan, tombol utama solid (biru langit), tombol sekunder solid (slate) yang menyala saat kode room lengkap, tautan "Coba suara moderator" berbentuk pill dengan ikon; Undercover mendapat ritme jarak, kode room mono, dan tombol Gabung merah saat kode lengkap. Responsif sampai lebar 375 px.
- **ONUW**: jeda hening 3 detik di antara giliran role malam; baris pagi kini memerintahkan "Cukup! Berhenti menggesek kartu." setelah buka mata (Microsoft dan ElevenLabs Adam dibuat ulang).
- **ONUW: pemenang dihitung otomatis.** Setelah tunjuk, pemain membalik kartu dan mengoreksi kartu terakhirnya (bisa tertukar oleh Robber/Troublemaker/Drunk); Hunter yang mati diminta menunjuk korbannya; aplikasi lalu menampilkan tim pemenang dan setiap pemain yang menang (`engine/onuw/winner.ts`, aturan resmi termasuk Tanner, Minion tanpa Werewolf, dan "tidak ada yang mati").
- **Deploy VPS (Hostinger) dengan Docker**: `compose.prod.yaml` (Postgres, migrasi sekali jalan, web di 127.0.0.1:3005 di belakang Nginx host), `.env.production.example`, panduan `deploy/HOSTINGER.md`; image produksi kini membawa script migrasi dan folder cache TTS. Diuji lokal, belum dideploy ke VPS.
- **ONUW buka kartu**: dropdown hanya berisi kartu yang mungkin dipegang pemain (kartu tengah hanya lewat Drunk) dan berkurang sesuai pilihan pemain lain.
- **Suara bawaan ElevenLabs Adam** (`TTS_PROVIDER` default `elevenlabs`, tanpa API key saat bermain); Microsoft Ardi dipilih dengan `TTS_PROVIDER=microsoft` atau per perangkat.
- **Pilihan suara dengan radio button** di `/games/werewolf/suara`: Microsoft Ardi (menyebut nama pemain) atau ElevenLabs Adam (emosi, tanpa nama), efek dramatis mati/nyala, lalu aksi "Dengarkan" dan "Simpan untuk perangkat ini". Pilihan disimpan di perangkat narator (HP host/TV) dan dipakai di game online dan ONUW lokal. ElevenLabs hanya memakai suara Adam.
- **Subagent Claude Code** di `.claude/agents/` (code-searcher, implementer, test-runner, reviewer) dan tabel routing model di `AGENTS.md`.

- **Werewolf: spesifikasi** (`src/games/werewolf/docs/`) dari zip PRD, diadaptasi ke stack PartyQuest (Postgres, SSE, cookie tamu, folder per game).
- **Werewolf: engine aturan** (Fase 1): Classic (giliran malam tetap, Guardian Angel/Doctor, Seer, Witch, Cupid, Cursed, Disease, Hunter, Tanner, Lovers, Mayor, voting terbuka dengan pembelaan/voting ulang, AFK + promosi Villager, 2 strike) dan ONUW (validasi deck N + 3, urutan narasi malam).
- **Platform multi-game** (Fase 2): room untuk `werewolf` hingga 16 pemain, pengaturan lobi oleh host, presence online, state rahasia disimpan atomik, retry otomatis untuk aksi serentak (migration `202611230001`).
- **Werewolf online** (Fase 3): adapter Online Room dengan tampilan privat per pemain (role sendiri, rekan Werewolf/Mason/Minion, hasil Seer, korban untuk Witch) dan tampilan publik tanpa bocoran role.
- **Werewolf UI Classic** (Fase 4): halaman setup, kartu katalog, editor pengaturan lobi, kartu role flip, UI malam gelap dengan panel `GILIRANMU`, mini-game Fake Tap, tampilan tereliminasi/penonton, diskusi, voting terbuka, Hunter, Paksa Lanjut, layar akhir dan linimasa.
- **Moderator suara** (Fase 5): voice pack 41 baris Microsoft Edge Neural (Ardi) di `public/audio/werewolf/`; empat pengumuman siang dengan nama pemain dibuat server (`node-edge-tts`) dan di-cache; voice pack ElevenLabs Adam (eleven_v4, tag emosi: sedih saat ada korban, tawa jahat Werewolf) di `public/audio/werewolf/elevenlabs/`; preset prosodi, efek dramatis Web Audio, opsi nama role berbahasa Inggris, halaman pilot `/games/werewolf/suara`; generator `npm run voice:generate`.
- **ONUW lokal** (Fase 6): `/games/werewolf/onuw`, deck builder, pendaftaran oper HP dengan semua role selalu tampil, alur pilih ulang saat tidak cocok, malam khusus suara dengan cincin hitung mundur, diskusi, hitung mundur tunjuk.
- **Layar TV** (Fase 7): kode pairing host sekali pakai, token TV baca-saja (hash SHA-256, migration `202611230002`), halaman `/games/werewolf/tv` dan `/games/werewolf/tv/<kode>` dengan subtitle moderator; suara pindah ke TV saat terhubung.
- Peringatan suara "satu menit lagi" saat diskusi siang.
- Layar TV: hasil voting terbuka digambar sebagai panah SVG animasi dari pemilih ke target (bobot Mayor lebih tebal, jumlah suara di target; animasi mati bila `prefers-reduced-motion`), daftar "pemilih → target" tetap ada.
- QR code untuk bergabung ke room di lobi dan di layar TV saat menunggu pemain (`qrcode-generator`, MIT, tanpa dependency; dirender sebagai SVG hitam-putih agar terbaca pemindai di tema gelap).
- Baris ONUW "pagi tiba" baru: pemain menggesek kartu sambil tutup mata lalu membuka mata (Microsoft dengan jeda 1000/800 ms, ElevenLabs Adam). Generator mendukung jeda `<break time="..."/>` lewat field `edgeText`.
- Rate limit route TTS: 30 permintaan/menit per room (game) dan 60/menit per tamu (pilot).

### Diubah

- Narator: pengumuman siang menyebut nama pemain, giliran malam hanya menyebut role.
- Doctor tampil dan diucapkan sebagai **Guardian Angel** (ID internal tetap `DOCTOR`).
- `ffmpeg` ditambahkan ke image Docker **dev** saja (untuk menggabungkan segmen suara).

### Diperbaiki

- Tema UI dalam game tidak cocok dengan kartu katalog: layar online Undercover kini bertema noir, lobi memakai tema game (`GameModule.themeClass`), dan latar siang/lobi Werewolf memakai navy `#020617` seperti kartu katalog (malam tetap hitam pekat).
- Form gabung room kini memakai tema game sebelum pemain bergabung (`gameKey` publik ikut dalam error `not_a_member`).
- Membuat room tanpa field `settings` ditolak; sekarang memakai pengaturan default game.
- Vote serentak bisa gagal karena konflik versi; sekarang dicoba ulang hingga 20 kali dengan jeda acak.
- Build image Docker produksi gagal karena devDependencies tidak terpasang di tahap builder.
- File audio uji yang tidak sengaja ter-commit dihapus; folder scratch dan sampel diabaikan git.

### Verifikasi terakhir

- `npm test`: 122 test lolos (termasuk test integrasi PostgreSQL), `typecheck` dan `lint` lolos.
- Image produksi (`docker build --target runner`) dibangun dan dijalankan: halaman, sesi tamu, room, file MP3, dan Edge TTS berfungsi.
- Smoke test API pada server lokal: alur Werewolf penuh hingga pemenang, vote serentak, rematch ronde 2, pairing TV dan privasi payload TV, route TTS (host/TV/non-host).
