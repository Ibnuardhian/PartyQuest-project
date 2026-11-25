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

- **Werewolf online: narator bicara dulu, baru timer jalan** (seperti ONUW). Server menambah lama suara (diukur ke `voice-pack.json` lewat `npm run voice:measure`; kalimat bernama diperkirakan dari panjang teks) ke tenggat tiap fase: intro malam (sebelumnya 6 dtk padahal klipnya 10,2 dtk), giliran role, pagi, Hunter, voting, dan pembelaan. Waktu aksi giliran malam minimal 10 detik setelah panggilan selesai (`nightTurnSeconds` tetap berlaku bila lebih besar). `actionStartsAt` dikirim ke klien: layar menampilkan "Narator berbicara…" lalu hitung mundur.
- **Waktu tambahan giliran malam**: bila pemegang role belum beraksi saat waktu habis (mis. Guardian Angel), giliran diperpanjang sekali 10 detik ("Waktu tambahan") sebelum dilewati. "Paksa lanjut" dari host saat narator masih memanggil tidak lagi memberi pemain strike AFK.
- **Suara tidak lagi saling menabrak**: narasi dimainkan satu per satu (permainan baru menghentikan yang lama, klip lama diselesaikan dulu sebelum klip berikut dimulai), sehingga kalimat pagi, pembacaan korban (Edge TTS), dan cadangan suara browser tidak tumpang tindih.
- **ONUW lokal: hasil dari kartu pemain yang mati saja.** Layar hasil tidak lagi meminta kartu akhir semua pemain: hanya kartu pemain yang mati (dan sasaran Hunter) yang diisi, lalu paling banyak dua pertanyaan ya/tidak soal Werewolf/Minion bila deck tidak bisa menjawabnya sendiri (tanpa Drunk tidak ada pertanyaan). Layar hasil menyebut tim pemenang, bukan nama pemenang. Logika di `engine/onuw/verdict.ts`, dengan tes yang membandingkannya dengan perhitungan meja penuh.
- **Mesin Werewolf: sebelas role baru (Fase 8, tugas 8.1/8.1b)**: Apprentice Seer, Prince, Troublemaker (suara kedua sekali per game), Spellcaster, Lone Wolf, Vampire, Alpha Wolf, Sorcerer, Wolf Cub, Dire Wolf, dan Dream Wolf, lengkap dengan urutan malam, aturan menang (`LONE_WOLF`, `VAMPIRE`), validasi komposisi, panel aksi malam, tampilan pemain per role, dua kalimat kemenangan baru, dan 15 tes. Sepuluh role selain Apprentice Seer hanya tersedia di mode lanjutan. Belum ada: tombol siang Troublemaker, banner bungkam/binasa, dan penyambungan narasi (8.7, 8.9).
- **Suara untuk role Fase 8** (belum dipanggil game karena mesinnya belum ada, tugas 8.1): 5 panggilan malam (Spellcaster, Vampire, Apprentice Seer, Sorcerer, Dire Wolf), 4 kalimat siang bernama (Pangeran terungkap, suara ganda Troublemaker, pemain dibungkam, korban Vampire) beserta klip cadangan, 10 istilah Inggris untuk mode bilingual, dan 18 MP3 (Edge + ElevenLabs Adam). Template bernama tetap hanya lolos `isAllowedNarration` dengan nama pemain nyata. Sisa: 8.1 (mesin), 8.7 (penyambungan narasi), 8.8 (dokumen).
- **Baris tamu ikut dibersihkan bersama room-nya** (`202611260002`): `cleanup_expired_rooms()` kini juga menghapus `guest_users` milik room yang dihapus, kecuali anggota/host room lain atau tamu yang terlihat <5 menit; tamu tanpa room dihapus setelah 1 jam. Mencatat `NOTICE: cleanup: N room(s), M guest(s) removed`. Diverifikasi lewat service `cleanup` di stack produksi (1 room dan 3 tamu terhapus; room berjalan, host, dan tamu baru aman) dan tes integrasi.
- **Werewolf: host bisa mengganti nama pemain** di lobi (ikon pensil), agar pemain tidak bisa memalsukan identitas sebagai pemain lain. Hanya host, hanya sebelum ronde berjalan, nama unik per room (tanpa memandang huruf besar-kecil dan spasi ganda), berlaku hanya di room itu. Fungsi `rename_room_member` (migration `202611260001`), route `PATCH /api/rooms/<kode>/members/<id>`, opt-in per game, dengan tes integrasi.
- **Tembakan Hunter kini pilih target lalu tombol Tembak** (sebelumnya langsung menembak saat nama diketuk).
- **Kartu "Daftar role" di ponsel memenuhi layar**: kartu yang dibalik terbuka 358×812 dengan margin 16 px dan teks 18 px (sebelumnya 149×199 px dengan teks 12 px, deskripsi Vampire terpotong).
- **Werewolf: mode lanjutan.** Role penuh twist (Witch, Mayor, Cupid, Lycan, Tanner, Cursed, Minion) hanya muncul bila host menyalakan "Mode lanjutan" di editor lobi (bawaan mati). Server menolak komposisi yang memuat role itu saat mati; komposisi otomatis lanjutan menambahkannya bertahap (maks. `ceil(pemain / 4)`, minimal satu Villager tersisa). Ringkasan room menampilkan mode, dan tile role lanjutan berlabel "lanjutan". Room lama tanpa pengaturan ini dianggap mode dasar.
- **Audit suara role bertwist**: tidak ada celah. Cupid dan Witch (satu-satunya role bertwist yang bergiliran di malam) dan keempat baris kemenangan sudah ada di pack Microsoft dan ElevenLabs. Ditambah `voice-coverage.test.ts` yang gagal bila role malam baru tidak punya baris suara sendiri (bukan baris "giliranmu selesai") atau ada MP3 yang hilang, plus daftar langkah di docs/03 §1.2b.
- **Kartu role di ponsel memenuhi layar**: diketuk, kartu terbalik dan mengisi layar dengan margin 16 px, teks 17 px, bisa di-scroll, dan ditutup dengan mengetuk kartu, area gelap, atau Escape; di layar lebar tetap terbalik di tempat.
- **Navbar katalog**: tombol "Online Room ↗" (yang hanya menuju Undercover) diganti **Gabung Room**: popover untuk memasukkan kode room dari game mana pun, diperiksa dulu lalu diarahkan ke lobi yang tepat.
- **Textarea nama pemain bergaya buku catatan**: tinggi baris, offset teks, dan garis memakai satu `--row-height`; garis ikut ter-scroll (`background-attachment: local`) untuk 10+ nama.
- **Dropdown kategori kata kustom** dengan badge jumlah pasangan (Campuran 307, Makanan 52, Hewan 52, Benda 52, Tempat 51, Pekerjaan 53), tanda ✓, dan keyboard penuh; dipakai di setup lokal, form buat room online, dan editor lobi.
- **Tombol kembali ke katalog** di lobi room, layar online Undercover dan Werewolf, ONUW, dan Pass-and-Play ("Keluar ke beranda" kini "Kembali ke katalog").
- **Pilot suara disembunyikan**: tautan "Coba suara moderator" hanya tampil dengan `WEREWOLF_VOICE_PILOT=1`, dan halaman `/games/werewolf/suara` 404 di produksi tanpa flag itu (narator bawaan tetap ElevenLabs Adam).
- **Undercover online: jendela clue konstan, diatur host.** Clue diberikan lisan dan bebas, jadi tidak ada lagi giliran per pemain atau tombol "selesai memberi petunjuk" yang membuat timer tampak mereset. Satu jendela waktu konstan (dari deadline server) tampil di HP semua pemain. Host memilih 1, 3, atau 5 menit (awal 3 menit) saat membuat room atau lewat editor pengaturan baru di lobi (kategori, jumlah Undercover, Mr. White, waktu clue). Ronde pertama punya 2 jendela clue, ronde berikutnya (setelah voting tanpa pemenang) 1 jendela; saat habis server memajukan fase sendiri. Layar menampilkan nomor putaran. Nilai lain ditolak server. Pass-and-Play tidak berubah.
- **Undercover online: role tidak lagi tampil atau terkirim.** Kartu privat hanya menampilkan kata (label CIVILIAN/UNDERCOVER dihapus); Mr. White, yang tidak punya kata, melihat "Kamu Mr. White". `PlayerView.private` tidak lagi memuat role (hanya `playerId` dan `word`), jadi role tidak bisa dibaca dari respons jaringan; role baru terbuka di hasil akhir. Dijaga test.
- **Pustaka kata Undercover**: `kamus_undercover.json` (300 pasangan) dileburkan ke `src/games/undercover/word-pairs.ts` bersama pasangan awal (307 pasangan unik, tiga duplikat Tempat/Campuran dibuang) dan file JSON dihapus. Kategori Campuran kini memakai seluruh pustaka. Kata Civilian dan Undercover diacak per game (`word_a`/`word_b` tidak selalu Civilian), dengan test pustaka dan penetapan kata.
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

- **Diskusi siang Werewolf minimal 3 menit** (sebelumnya 1 menit): dengan 1 menit, peringatan "satu menit lagi" bertabrakan dengan suara pagi dan pembacaan korban. Slider dan validasi server memakai batas baru; room lama yang tersimpan dengan diskusi lebih pendek otomatis dinaikkan saat ronde dimulai.
- Narator: pengumuman siang menyebut nama pemain, giliran malam hanya menyebut role.
- Doctor tampil dan diucapkan sebagai **Guardian Angel** (ID internal tetap `DOCTOR`).
- `ffmpeg` ditambahkan ke image Docker **dev** saja (untuk menggabungkan segmen suara).

### Diperbaiki

- **Mengubah konfigurasi room tidak lagi membatalkan status siap** (Werewolf dan Undercover; migrasi `202611260003`): pemain yang sudah siap tetap siap saat host mengganti pengaturan. Validasi komposisi tetap dijalankan saat host memulai ronde.
- **Kilatan tema hijau saat refresh lobi room**: HTML pertama `/room/<kode>` tidak membawa tema game (game baru diketahui setelah data room diambil), sehingga tema hijau platform tampil sesaat. Halaman lobi kini mencari game room di server sehingga langsung bertema `undercover-theme`/`werewolf-theme`.
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
