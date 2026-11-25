# PartyQuest UI Style Guide

Panduan ini mendokumentasikan gaya UI PartyQuest agar game baru tetap terasa satu keluarga dengan katalog yang sudah ada. Gunakan sebagai referensi sebelum mengubah komponen atau menambah halaman.

## Arah visual

- Kesan: hangat, sosial, ringan, rapi, dan sedikit editorial. UI mendukung suasana bermain bersama; jangan terasa seperti dashboard administrasi.
- Bahasa utama UI adalah Bahasa Indonesia. Pakai kalimat pendek dan instruksi yang mudah dipahami pemain baru.
- Katalog adalah beranda produk. Undercover merupakan game pertama yang dapat dimainkan; game mendatang tetap berstatus “Segera hadir” sampai benar-benar tersedia.
- Jangan menampilkan kontrol mulai/main pada kartu yang belum tersedia.

## Warna dan permukaan

- Ikuti token CSS di `src/app/globals.css`: `--ink` untuk teks utama, `--muted` untuk teks sekunder, `--paper` untuk latar halaman, `--green` dan `--green-dark` untuk aksen, `--line` untuk garis, serta `--mint` untuk permukaan lembut.
- Halaman menggunakan latar hijau pucat yang hangat; kartu utama putih dengan garis tipis dan bayangan sangat lembut.
- Hijau menandai aksi utama, status aktif, dan aksen judul. Warna peringatan dipakai seperlunya dan tetap memiliki kontras yang terbaca.
- Hindari menambahkan warna aksen baru jika token yang ada dapat dipakai.

## Tipografi

- Teks UI menggunakan Arial/Helvetica untuk keterbacaan.
- Judul besar dan judul kartu memakai Georgia atau serif sistem, dengan bobot ringan dan jarak huruf rapat.
- Label kategori, status, dan kicker memakai huruf kecil, tebal, dan tracking renggang; jaga agar tetap terbaca pada layar kecil.
- Ukuran teks sekunder boleh lebih kecil, tetapi jangan mengandalkan warna saja untuk menyampaikan status.

## Tata letak dan komponen

- Batasi halaman desktop dengan `.page-shell` dan gunakan ruang kosong yang cukup di antara header, konten, dan footer.
- Header memakai wordmark PartyQuest di kiri dan navigasi/status ringkas di kanan.
- Katalog memakai grid tiga kolom di desktop, dua kolom di tablet, dan satu kolom di ponsel. Kartu game punya artwork sederhana, label kategori/jumlah pemain, ringkasan, dan satu aksi yang jelas.
- Halaman katalog memakai identitas visual per game pada art/card masing-masing. Kartu Undercover dengan label “GAME PERTAMA” memakai Classic Noir / dossier; tema Classic Noir juga aktif sejak setup Undercover dibuka sampai permainan berakhir: hitam pitch `#0A0A0A`, kertas `#E5E0D8`, merah darah `#8B0000`, biru tinta `#1B263B`, dan charcoal `#222222`.
- Masuk/keluar Undercover memakai fade latar noir dan animasi masuk singkat untuk katalog, setup, atau layar game. Hormati `prefers-reduced-motion` dengan mematikan gerakan non-esensial.
- Undercover memakai nuansa serif/stencil dramatis dengan tracking judul lebar, bayangan kontras, vignette dan grain halus, garis lipatan kertas, aksen benang merah, dan stempel classified. Font stack mengutamakan Cinzel/Playfair Display dengan fallback serif sistem.
- Kartu dossier memakai bidang kertas off-white, sudut tegas, garis halus, serta shadow; tombol utama merah dengan label uppercase. Kontras teks tetap terbaca.
- Halaman game memberi prioritas pada satu tindakan utama per fase. Informasi privat harus dibedakan jelas dari informasi publik.
- Katalog (`/`) hanya menampilkan kartu game dari registry. Setup Undercover berada di `/games/undercover`; tautan Online Room membuka `/games/undercover?mode=online` pada kartu kanan yang sama, label berubah menjadi MODE ONLINE dan form berganti ke buat/gabung room. Palet Noir dan gaya dossier tetap sama.
- Tema visual milik satu game disimpan di folder game tersebut (contoh `src/games/undercover/ui/undercover.css`) dan diimpor oleh komponen game. `src/app/globals.css` hanya berisi token dan komponen platform bersama.

## Aturan interaksi

- Beri state hover/focus yang terlihat dan state disabled yang jelas. Semua kontrol harus dapat digunakan dengan keyboard.
- Label form harus terhubung ke input. Timer menggunakan elemen `<time>` dengan angka tabular agar tidak bergeser saat berubah.
- Dalam Pass-and-Play, clue, diskusi, dan voting dilakukan lisan di luar aplikasi. Tampilkan satu timer maksimum 3 menit untuk ronde clue; setelah voting, pemain memilih dan mengonfirmasi pemain tereliminasi di aplikasi. Jangan menyimpan clue, giliran clue, atau pilihan voting.
- Kartu privat Pass-and-Play menampilkan kata saja; jangan menampilkan label role sebelum permainan selesai. Satu pengecualian yang disengaja: Mr. White tidak punya kata, sehingga kartunya bertuliskan "Kamu adalah Mr. White!". Tetap gunakan hand-off sebelum membuka kartu.
- Online Room tetap memakai clue bergiliran dan voting online dengan state server dan deadline server.

## Kit UI game (katalog, landing & setup)

- Header katalog: merek di kiri; di kanan indikator status dan tombol **Gabung Room** (`QuickJoinRoom`), popover kecil untuk memasukkan kode room 6 karakter dari game mana pun. Kode diperiksa dulu (`GET /api/rooms/<kode>`: 404 tidak ditemukan, 410 kedaluwarsa), lalu diarahkan ke `/room/<kode>`; lobi mengenali game dari kode. Tidak ada tombol "Online Room" global karena tiap game mengatur mode Online/Pass-and-Play sendiri. Di ponsel teks status disembunyikan agar header seimbang.
- Setiap layar game (setup, lobi, dalam game online/lokal, ONUW) punya tautan kembali ke katalog (`CatalogLink`: "Kembali ke katalog" atau "Katalog game" di topline); layar TV baca-saja dikecualikan.
- Textarea nama pemain Undercover berbentuk buku catatan: `--row-height` (36 px) mengatur tinggi baris, jarak garis (`repeating-linear-gradient`), dan tinggi kotak; `--row-offset` (5 px) menurunkan teks sehingga baseline duduk sekitar 6 px di atas garis; `background-attachment: local` membuat garis ikut ter-scroll; tinggi tetap 5 baris dan maksimal 8.
- Dropdown kategori kata memakai `CategorySelect` (bukan `<select>` bawaan OS): tint merah tua untuk aktif/hover, tanda ✓ pada pilihan, badge jumlah pasangan kata di kanan (Campuran = seluruh pustaka). Menu dirender lewat portal dengan posisi `fixed` agar tidak terpotong kartu, membuka ke atas bila ruang bawah kurang, minimal 260 px lebar di ponsel, dan mengikuti pola keyboard combobox/listbox.

- Katalog memakai satu `GameCatalogCard` (`src/components/catalog/game-catalog-card.tsx`) untuk semua game: tinggi sama, sudut 16 px, banner 192 px dengan eyebrow `GAME 01/02`, baris genre + pill jumlah pemain (ikon pengguna berwarna aksen), judul Title Case, deskripsi maksimal 2 baris, dan tombol di dasar kartu (tint aksen saat diam, solid aksen saat hover). Game hanya mengisi metadata, `accentColor`, dan motif banner (`artwork`). Grid: 1 kolom di ponsel, 2 di tablet, 3 di layar lebar. Canvas katalog gelap `#050914`.

- Komponen bersama ada di `src/components/ui/game-ui.tsx` (platform, tanpa aturan game): `GameCard`, `GameCardSection`, `GameCardHeading`, `GameField`, `FilledInput`, `GameButton`/`GameLinkButton`, `AccentPill`, `StepperGrid`/`StepperTile`, `ThemedSlider`, `ValidationBanner`.
- Tema game cukup mengisi `--game-accent` dan `--game-accent-ink` (warna teks di atas aksen), misalnya Werewolf `#38BDF8`/`#020617`. Tint, focus ring, isian slider, dan tombol utama diturunkan dari aksen dengan `color-mix`.
- Tiga tingkat permukaan: kanvas `#050914`, kartu `#0B1224` (sudut 16 px), kontrol terbenam `#060B17`. Hindari tampilan "semua garis tipis": input terisi, tombol utama solid aksen, tombol sekunder solid slate.
- Tile counter: redup saat 0, ber-border aksen saat > 0; titik kubu merah (lawan), aksen (kawan), kuning (netral) selalu punya label aksesibel. Tombol stepper 36 px.
- Validasi memakai `ValidationBanner` (hijau saat cocok, kuning dengan jumlah yang kurang/lebih); tombol utama nonaktif sampai valid.
- Grid tile mengikuti lebar wadahnya (`auto-fill`, min 240 px), jadi satu kolom di ponsel dan di sidebar lobi yang sempit.

## Tema per game

- Setiap game memiliki satu tema yang dipakai konsisten dari kartu katalog, halaman setup, lobi, hingga layar dalam game. Modul game menyediakan `themeClass` dan lobi platform menerapkannya; jangan menampilkan layar game dengan tema hijau platform.

## Werewolf

- Tema "Dark Outline" (`src/games/werewolf/ui/werewolf.css`): siang dan lobi memakai navy `#020617` seperti kartu katalog, malam memakai hitam pekat `#000000`, garis tipis slate `#1E293B`, aksen cyan `#0EA5E9` pada opasitas rendah, teks `#94A3B8`/`#64748B`. Jangan memakai permukaan putih atau terang selama fase malam agar layar tidak menerangi wajah pemain.
- Halaman setup Werewolf (`.ww-setup-card`): kartu terangkat `#0B1224` dengan sudut 16 px, input terisi `#060A15` dengan fokus cyan, satu tombol utama solid biru langit (`.ww-btn-primary`), tombol sekunder solid slate (`.ww-btn-secondary`, menyala cyan saat kode room lengkap), dan susunan flex dengan `gap` (bukan margin bertumpuk) agar teks dan tombol tidak pernah bertumpuk. Gaya terang ini hanya untuk setup; layar malam tetap redup.
- Fase malam (`.ww-is-night`): header dan footer diredupkan; pemain hidup yang bukan giliran melihat mini-game Fake Tap, pemegang role aktif melihat panel `GILIRANMU` dengan fade 200 ms, pemain tereliminasi melihat tampilan pasif tanpa kontrol.
- Kartu role memakai flip 3D yang dimatikan bila `prefers-reduced-motion`. Label kubu memakai badge berwarna (warga cyan, Werewolf merah, independen kuning) yang juga diberi teks, bukan warna saja.
- Layar TV (`/games/werewolf/tv/<kode>`) memakai tipografi besar, grid pemain, dan bilah subtitle moderator di bawah; tidak pernah menampilkan role sebelum permainan selesai.
- Nama role yang tampil diambil dari `CLASSIC_ROLE_INFO` (misalnya Doctor tampil sebagai "Guardian Angel"); jangan menulis nama role langsung di komponen.
- Kartu role di ponsel (≤ 640 px): saat diketuk kartu terbalik dan memenuhi layar dengan margin 16 px (`.ww-role-card.is-expanded`, `position: fixed`, teks deskripsi 17 px, scroll internal bila lebih panjang, backdrop gelap yang menutup kartu saat diketuk, scroll halaman dikunci). Slot `.ww-role-slot` menjaga tata letak agar tidak bergeser. Di layar lebar kartu hanya terbalik di tempat.
- Editor pengaturan Werewolf dirender di lobi yang memakai tema Werewolf, sehingga `.ww-editor` mewarisi warna gelap tema tersebut. Form gabung room juga memakai tema game, karena `GET /api/rooms/<kode>` mengembalikan `gameKey` publik bersama error `not_a_member`.
- Pass-and-Play memakai `/games/undercover/local#<hash-sesi>`. ID sesi dan salt acak berada di `sessionStorage`; hanya hash SHA-256 yang tampil di fragment URL. Kata dan peran tetap privat dari URL. Hash berfungsi sebagai penanda sesi, bukan batas keamanan. Beri jalur “Lanjutkan permainan” jika pemain kembali ke katalog selama sesi tab masih tersedia.
- Deadline Online Room berasal dari server dan tetap sama setelah refresh. UI menampilkan sisa waktu dari deadline tersebut; UI klien tidak boleh membuat ulang atau memperpanjang deadline.
- Layout harus tetap berfungsi tanpa scroll horizontal pada lebar ponsel. Pertahankan hierarki konten dan aksi utama ketika grid berubah menjadi satu kolom.

## Implementasi

- Reuse komponen dan CSS token sebelum membuat variasi baru.
- Hindari framework atau dependency UI tambahan.
- Ubah dokumentasi ini jika sistem visual produk berubah secara menyeluruh; README tetap menjadi sumber setup, aturan game, dan konfigurasi teknis.
