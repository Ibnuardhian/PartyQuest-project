# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/).

## [Belum dirilis] — branch `werewolf-game` (2026-11-23)

Semua commit di bawah ini lokal di branch `werewolf-game` dan **belum di-push**.

### Belum selesai / perlu keputusan

- [ ] **Uji langsung multi-perangkat** (Fase 7.2): Werewolf Classic, ONUW, dan layar TV belum dicoba dengan beberapa HP dan TV sungguhan di browser. Semua aturan, API, halaman, dan image produksi sudah diuji otomatis atau lewat smoke test.
- [ ] **Pilihan suara dari pemilik proyek:**
  - preset Microsoft (`standar` / `berat` / `sangat-berat` / `gelap`); `activePreset` masih `standar`;
  - efek dramatis default (`dramaticEffects` masih `false`);
  - cara pelafalan nama role (`off` / `segments` / `multilingual` / Brian); pack masih `off` dan hanya ada sampel di `public/audio/werewolf/samples/` (tidak di-commit);
  - penyedia default (`TTS_PROVIDER` di `.env` masih `microsoft`).
- [ ] **ElevenLabs "Eyang"** (`tX4zpyB6s34no1FgD0Mm`) hanya bisa dipakai lewat API dengan paket berbayar (HTTP 402 di paket gratis). Pack ElevenLabs yang ter-commit memakai suara premade **Adam** (eleven_v4, dengan emosi). Setelah upgrade: `docker compose run --rm --no-deps web npm run voice:generate -- --provider elevenlabs --force`.
- [ ] **Lisensi ElevenLabs paket gratis**: periksa ketentuan ElevenLabs (atribusi/penggunaan komersial) sebelum merilis audio yang dibuat dengan paket gratis.
- [ ] **Layar TV**: belum ada panah animasi SVG untuk hasil voting (sekarang daftar "pemilih → target"), belum ada QR code untuk penonton atau join, dan TV hanya membaca (fase dimajukan oleh request pemain, bukan TV).
- [ ] **Lobi**: QR code untuk join room (spesifikasi Fase 2.4) belum dibuat; butuh library QR (belum ditambahkan sebagai dependency).
- [ ] **ONUW**: pemenang tidak dihitung otomatis (kartu fisik bisa tertukar di malam hari); aplikasi hanya mencatat siapa yang tertunjuk.
- [ ] **Deploy Vercel** belum diverifikasi: cache TTS di Vercel hanya `/tmp` (sementara), dan layanan Edge TTS dari Vercel belum dicoba. `LISTEN/NOTIFY` butuh koneksi Postgres langsung atau session pooling.
- [ ] **Cache TTS di disk** belum punya kebijakan pembersihan otomatis. Rate limit route TTS sudah ada, tetapi per proses server (tiap instance serverless punya batasnya sendiri).
- [ ] **File `werewolf-tts-voice-pack.zip`** masih ada di root proyek (tidak di-commit). Isinya sudah dilebur; tunggu konfirmasi untuk dihapus.
- [ ] **Push dan merge** ke `main` menunggu persetujuan.

### Ditambahkan

- **Werewolf: spesifikasi** (`src/games/werewolf/docs/`) dari zip PRD, diadaptasi ke stack PartyQuest (Postgres, SSE, cookie tamu, folder per game).
- **Werewolf: engine aturan** (Fase 1): Classic (giliran malam tetap, Guardian Angel/Doctor, Seer, Witch, Cupid, Cursed, Disease, Hunter, Tanner, Lovers, Mayor, voting terbuka dengan pembelaan/voting ulang, AFK + promosi Villager, 2 strike) dan ONUW (validasi deck N + 3, urutan narasi malam).
- **Platform multi-game** (Fase 2): room untuk `werewolf` hingga 16 pemain, pengaturan lobi oleh host, presence online, state rahasia disimpan atomik, retry otomatis untuk aksi serentak (migration `202611230001`).
- **Werewolf online** (Fase 3): adapter Online Room dengan tampilan privat per pemain (role sendiri, rekan Werewolf/Mason/Minion, hasil Seer, korban untuk Witch) dan tampilan publik tanpa bocoran role.
- **Werewolf UI Classic** (Fase 4): halaman setup, kartu katalog, editor pengaturan lobi, kartu role flip, UI malam gelap dengan panel `GILIRANMU`, mini-game Fake Tap, tampilan tereliminasi/penonton, diskusi, voting terbuka, Hunter, Paksa Lanjut, layar akhir dan linimasa.
- **Moderator suara** (Fase 5): voice pack 41 baris Microsoft Edge Neural (Ardi) di `public/audio/werewolf/`; empat pengumuman siang dengan nama pemain dibuat server (`node-edge-tts`) dan di-cache; voice pack ElevenLabs Adam (eleven_v4, tag emosi: sedih saat ada korban, tawa jahat Werewolf) di `public/audio/werewolf/elevenlabs/`; preset prosodi, efek dramatis Web Audio, opsi nama role berbahasa Inggris, halaman pilot `/games/werewolf/suara`; generator `npm run voice:generate`.
- **ONUW lokal** (Fase 6): `/games/werewolf/onuw`, deck builder, pendaftaran oper HP dengan semua role selalu tampil, alur pilih ulang saat tidak cocok, malam khusus suara dengan cincin hitung mundur, diskusi, hitung mundur tunjuk.
- **Layar TV** (Fase 7): kode pairing host sekali pakai, token TV baca-saja (hash SHA-256, migration `202611230002`), halaman `/games/werewolf/tv` dan `/games/werewolf/tv/<kode>` dengan subtitle moderator; suara pindah ke TV saat terhubung.
- Peringatan suara "satu menit lagi" saat diskusi siang.
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

- `npm test`: 118 test lolos (termasuk test integrasi PostgreSQL), `typecheck` dan `lint` lolos.
- Image produksi (`docker build --target runner`) dibangun dan dijalankan: halaman, sesi tamu, room, file MP3, dan Edge TTS berfungsi.
- Smoke test API pada server lokal: alur Werewolf penuh hingga pemenang, vote serentak, rematch ronde 2, pairing TV dan privasi payload TV, route TTS (host/TV/non-host).
