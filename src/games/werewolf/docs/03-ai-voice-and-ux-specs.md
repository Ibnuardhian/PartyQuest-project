# 03 — AI Voice Moderator & Physical Anti-Tell UX Specifications

> **PartyQuest adaptation:** This file keeps the original Werewolf Hybrid spec wording. Stack references were mapped to the PartyQuest platform (guest cookie, PostgreSQL, SSE). See `04-architecture-and-platform-integration.md` for how each item is implemented.

## 1. AI Voice Moderator Engine (Template + TTS)

### 1.1 Architecture & Audio Routing Rules
- **No LLM Generation Delay:** All voice lines are generated from deterministic Indonesian text templates interpolated with dynamic variables (`{playerName}`, `{victimName}`, `{seconds}`).
- **Strict Single-Device Audio Output:**
  - `TV_SCREEN` client connected -> `TV_SCREEN` plays audio; `HOST` phone stays muted.
  - No `TV_SCREEN` connected -> `HOST` phone plays audio; all other `PLAYER` phones stay muted.
- **Browser Autoplay & Sleep Prevention:**
  - Host/TV must click a `"Mulai Permainan / Aktifkan Suara"` button at game start to unlock Web Audio API (`AudioContext.resume()`).
  - Request `navigator.wakeLock.request('screen')` on TV and active player devices so screens do not lock mid-night.

### 1.2 Indonesian TTS Script Templates

#### Mode 1: Hybrid Classic Scripts
| Trigger Event | Indonesian Voice Script Template |
| :--- | :--- |
| `NIGHT_INTRO` | *"Malam ke-{nightNumber} telah tiba. Seluruh warga desa menunduk dan perhatikan layar masing-masing. Tetap tenang dan jangan bersuara."* |
| `NIGHT_TURN_START` | *"Giliran {roleName} beraksi. Silakan tentukan pilihanmu di layar sekarang."* |
| `NIGHT_TURN_END` | *"Waktu untuk {roleName} telah selesai."* |
| `DAWN_SINGLE_KILL` | *"Pagi telah tiba! Warga desa terbangun dengan kabar duka... {victimName} ditemukan tewas semalam."* |
| `DAWN_MULTI_KILL` | *"Pagi telah tiba! Tragedi berdarah terjadi semalam... {victimList} ditemukan tewas."* |
| `DAWN_NO_KILL` | *"Pagi telah tiba! Keajaiban terjadi semalam, tidak ada satu pun warga desa yang menjadi korban."* |
| `HUNTER_TRIGGER` | *"Pemburu {hunterName} gugur, namun ia sempat menarik pelatuk senjatanya! {hunterName}, pilih satu targetmu sekarang."* |
| `DAY_START` | *"Fase diskusi dimulai. Kalian memiliki waktu {minutes} menit untuk berdebat dan mencari pelaku."* |
| `DAY_1MIN_WARN` | *"Waktu diskusi tersisa satu menit lagi."* |
| `VOTING_START` | *"Waktu diskusi habis! Silakan pilih satu nama di layar HP kalian untuk dieksekusi."* |
| `VOTE_TIE` | *"Hasil voting seri! Para kandidat yang seri memiliki waktu tiga puluh detik untuk membela diri sebelum voting ulang."* |
| `EXECUTION_RESULT` | *"Warga desa telah memutuskan. {executedName} dieksekusi hari ini."* |
| `NO_EXECUTION` | *"Voting kembali seri. Tidak ada warga yang dieksekusi hari ini."* |
| `GAME_OVER` | *"Permainan berakhir! Kemenangan diraih oleh kubu {winningFaction}!"* |

#### Mode 2: ONUW Voice-Only Scripts (10–15s Timed Pauses)
| Step | Indonesian Voice Script Template |
| :--- | :--- |
| `ONUW_START` | *"Semua pemain tutup mata. Pastikan HP berada di tengah meja dan jangan menyentuh layar."* |
| `WEREWOLF` | *"Werewolf, buka mata dan kenali sesama Werewolf. Jika sendirian, lihat satu kartu tengah... [12s countdown] ... Werewolf, tutup mata."* |
| `MINION` | *"Minion, buka mata. Werewolf, acungkan jempol kalian agar Minion mengenali kalian... [10s countdown] ... Werewolf turunkan jempol, Minion tutup mata."* |
| `MASON` | *"Mason, buka mata dan kenali sesama rekan Mason kalian... [10s countdown] ... Mason, tutup mata."* |
| `SEER` | *"Seer, buka mata. Lihat kartu milik satu pemain lain, atau dua kartu di tengah meja... [14s countdown] ... Seer, tutup mata."* |
| `ROBBER` | *"Robber, buka mata. Tukar kartumu dengan kartu satu pemain lain, lalu lihat kartu barumu... [14s countdown] ... Robber, tutup mata."* |
| `TROUBLEMAKER` | *"Troublemaker, buka mata. Tukar kartu milik dua pemain lain tanpa melihat isinya... [14s countdown] ... Troublemaker, tutup mata."* |
| `DRUNK` | *"Drunk, buka mata. Tukar kartumu dengan satu kartu di tengah meja tanpa melihatnya... [12s countdown] ... Drunk, tutup mata."* |
| `INSOMNIAC` | *"Insomniac, buka mata dan periksa kartumu sendiri sekarang... [10s countdown] ... Insomniac, tutup mata."* |
| `ONUW_DAY` | *"Semua pemain, buka mata! Pagi telah tiba. Kalian punya waktu {minutes} menit untuk berdiskusi."* |
| `ONUW_VOTE` | *"Waktu habis! Hitungan mundur dimulai... Tiga... Dua... Satu... Tunjuk target kalian sekarang!"* |

---

## 2. Night Phase "Dark Outline UI" & Fake Tap Specification

### 2.1 Visual Luminance Constraints (Anti-Face-Glow)
- **Background:** Pure OLED black `#000000`.
- **Strokes & Borders:** `1px solid` muted slate/cyan `#1E293B` (idle) and `#0EA5E9` at `35%` opacity (interactive).
- **Typography:** `#64748B` (muted) and `#94A3B8` (active prompt) — **strictly no white `#FFFFFF` backgrounds or bright cards** during Night Phase.

### 2.2 Fake Tap Mini-Game Engine (Alive Players Only)
- **Who sees it:**
  1. Every **alive** `VILLAGER` throughout the entire Night Phase.
  2. Every **alive** active role (`SEER`, `DOCTOR`, `WEREWOLF`, `WITCH`, `CUPID`, `MASON`) **before** and **after** their specific `"GILIRANMU"` window.
- **Who is excluded (Dead State):**
  - Eliminated players (`isAlive === false`) **never** see or perform the Fake Tap mini-game or any night interactions. Instead, their screen displays a static, non-interactive **Dead / Spectator View** governed strictly by `deadRevealMode`:
    - `SPECTATOR_REVEAL`: Read-only list/cards showing the roles of all other players (`isAlive` and dead).
    - `KEEP_HIDDEN`: Passive *"Kamu Telah Tereliminasi"* banner where other players' roles remain concealed until `GAME_OVER`.
- **Mechanic (for Alive Players):**
  - Displays subtle header text: *"Fase Malam Berlangsung — Ketuk lingkaran berurutan untuk menyamarkan aktivitas"*.
  - Spawns `3` to `4` numbered outline circles (`1`, `2`, `3`, `4`) at randomized non-overlapping coordinates within the safe viewport.
  - Player must tap `1 -> 2 -> 3 -> 4` in order; upon completing `4`, a new sequence immediately spawns after a `400ms` delay.
  - When the alive player's own role turn arrives, the Fake Tap canvas smoothly cross-fades (`200ms`) into the **`"GILIRANMU"`** action panel without any brightness spike, and returns to the Fake Tap canvas once locked or expired.

---

## 3. Shared Screen (TV / Laptop) Layout (`/games/werewolf/tv/[roomCode]`)
- **Top Bar:** Room Code badge, mini QR code (for late spectators), Phase Title, and large radial countdown timer.
- **Center Stage (65% width):**
  - Circular/Grid arrangement of all player cards showing Avatar, Nickname, Alive/Dead status badge, and AFK Penalty icon (if applicable).
  - During `OPEN_VOTING` reveal: Animated SVG arrows or voter badges mapped directly beneath each target's card showing *who voted for whom*.
- **Bottom Banner (20% width):** Live AI Moderator subtitle ticker with audio equalizer waveform animation.
