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
- Kartu privat Pass-and-Play menampilkan kata saja; jangan menampilkan label role sebelum permainan selesai. Tetap gunakan hand-off sebelum membuka kartu.
- Online Room tetap memakai clue bergiliran dan voting online dengan state server dan deadline server.

## Werewolf

- Tema "Dark Outline" (`src/games/werewolf/ui/werewolf.css`): latar hitam pekat `#000000`, garis tipis slate `#1E293B`, aksen cyan `#0EA5E9` pada opasitas rendah, teks `#94A3B8`/`#64748B`. Jangan memakai permukaan putih atau terang selama fase malam agar layar tidak menerangi wajah pemain.
- Fase malam (`.ww-is-night`): header dan footer diredupkan; pemain hidup yang bukan giliran melihat mini-game Fake Tap, pemegang role aktif melihat panel `GILIRANMU` dengan fade 200 ms, pemain tereliminasi melihat tampilan pasif tanpa kontrol.
- Kartu role memakai flip 3D yang dimatikan bila `prefers-reduced-motion`. Label kubu memakai badge berwarna (warga cyan, Werewolf merah, independen kuning) yang juga diberi teks, bukan warna saja.
- Layar TV (`/games/werewolf/tv/<kode>`) memakai tipografi besar, grid pemain, dan bilah subtitle moderator di bawah; tidak pernah menampilkan role sebelum permainan selesai.
- Nama role yang tampil diambil dari `CLASSIC_ROLE_INFO` (misalnya Doctor tampil sebagai "Guardian Angel"); jangan menulis nama role langsung di komponen.
- Editor pengaturan Werewolf dirender di lobi platform yang terang, sehingga kelas `.ww-editor` memakai warna platform.
- Pass-and-Play memakai `/games/undercover/local#<hash-sesi>`. ID sesi dan salt acak berada di `sessionStorage`; hanya hash SHA-256 yang tampil di fragment URL. Kata dan peran tetap privat dari URL. Hash berfungsi sebagai penanda sesi, bukan batas keamanan. Beri jalur “Lanjutkan permainan” jika pemain kembali ke katalog selama sesi tab masih tersedia.
- Deadline Online Room berasal dari server dan tetap sama setelah refresh. UI menampilkan sisa waktu dari deadline tersebut; UI klien tidak boleh membuat ulang atau memperpanjang deadline.
- Layout harus tetap berfungsi tanpa scroll horizontal pada lebar ponsel. Pertahankan hierarki konten dan aksi utama ketika grid berubah menjadi satu kolom.

## Implementasi

- Reuse komponen dan CSS token sebelum membuat variasi baru.
- Hindari framework atau dependency UI tambahan.
- Ubah dokumentasi ini jika sistem visual produk berubah secara menyeluruh; README tetap menjadi sumber setup, aturan game, dan konfigurasi teknis.
