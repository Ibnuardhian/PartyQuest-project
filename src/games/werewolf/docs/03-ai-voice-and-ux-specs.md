# 03 — AI Voice Moderator & Physical Anti-Tell UX Specifications

> **PartyQuest adaptation:** This file keeps the original Werewolf Hybrid spec wording. Stack references were mapped to the PartyQuest platform (guest cookie, PostgreSQL, SSE). See `04-architecture-and-platform-integration.md` for how each item is implemented.

## 1. AI Voice Moderator (ElevenLabs default, Microsoft Edge Neural fallback)

> **PartyQuest decision (2026-11-23):** merged from `werewolf-tts-voice-pack.zip` (the static MP3 pack and its spec update). The original template table is in git history (`a08d009`). Player names are spoken in daytime announcements; night turns name roles only.

### 1.1 Architecture & Audio Routing Rules
- **Static voice pack (zero runtime TTS):** 41 lines (22 Classic, 19 ONUW) are pre-generated MP3 files in `public/audio/werewolf/classic/` and `public/audio/werewolf/onuw/`, created with **ElevenLabs by default** (or Microsoft Edge Neural TTS with `--provider microsoft`) (`id-ID-ArdiNeural`, rate `-6%`, pitch `-4Hz`; alternative `id-ID-GadisNeural`) by `npm run voice:generate` (`scripts/generate-werewolf-voice.mjs`, reads `src/games/werewolf/voice/voice-pack.json`). The files are committed, so play time needs no API.
- **Named announcements (on demand):** four daytime lines name the players involved. The host's device asks `POST /api/games/werewolf/tts`; the configured provider voices the named template and caches it per line. Only the four approved templates and names from that session are allowed.
- **Fallback chain:** named line from Microsoft → the pack's generic MP3 for that event (no name) → browser Web Speech (`id-ID`).
- **ElevenLabs default:** `TTS_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY` select ElevenLabs Adam for named lines and the static pack in `/audio/werewolf/elevenlabs/`; failures fall back to Microsoft.
- **Character:** prosody presets (`standar` … `gelap`) and optional dramatic effects (reverb, bass, compressor in the browser). Edge offers no emotional styles for Indonesian voices.
- **English role names (optional):** `segments` joins Ardi (Indonesian) with an English voice for role names into one MP3; `multilingual` uses one multilingual voice for the whole line. Compare on the pilot page before regenerating the pack.
- **Strict Single-Device Audio Output:**
  - `TV_SCREEN` client connected -> `TV_SCREEN` plays audio; `HOST` phone stays muted.
  - No `TV_SCREEN` connected -> `HOST` phone plays audio; all other `PLAYER` phones stay muted.
- **Browser Autoplay & Sleep Prevention:**
  - Host/TV taps `"Aktifkan suara moderator"` to unlock browser audio playback.
  - Request `navigator.wakeLock.request('screen')` on TV and active player devices so screens do not lock mid-night.

### 1.2 Mode 1: Hybrid Classic (`/audio/werewolf/classic/`)
| Event | Audio | Spoken text |
| :--- | :--- | :--- |
| `NIGHT_INTRO` | `night_intro.mp3` | *"Malam telah tiba... Seluruh warga desa, tundukkan kepala dan perhatikan layar masing-masing. Tetap tenang... dan jangan bersuara."* |
| `TURN_<ROLE>` | `turn_cupid/mason/werewolf/doctor/seer/witch.mp3` | Per role, e.g. *"Giliran Seer beraksi... Pilih satu pemain untuk menerawang identitas aslinya."* |
| `TURN_END` | `turn_end.mp3` | *"Waktu giliranmu telah selesai."* |
| `DAWN_SINGLE_KILL` | **Microsoft on demand** (fallback `dawn_single_kill.mp3`) | *"Pagi telah tiba! Warga desa terbangun dengan kabar duka... {victimName} ditemukan tewas semalam."* |
| `DAWN_MULTI_KILL` | **Microsoft on demand** (fallback `dawn_multi_kill.mp3`) | *"Pagi telah tiba! Tragedi berdarah terjadi semalam... {victimList} ditemukan tewas!"* |
| `DAWN_NO_KILL` | `dawn_no_kill.mp3` | *"Pagi telah tiba! Keajaiban terjadi semalam... Tidak ada satu pun warga desa yang menjadi korban!"* |
| `HUNTER_REVENGE` | **Microsoft on demand** (fallback `hunter_revenge.mp3`) | *"Sang Pemburu, {hunterName}, gugur, namun ia sempat menarik pelatuk senjatanya! {hunterName}... pilih satu targetmu di layar sekarang!"* |
| `DAY_START` | `day_discussion_start.mp3` | *"Fase diskusi dimulai! Kalian punya waktu untuk berdebat dan mencari siapa pelaku di antara kalian."* |
| `DAY_1MIN_WARN` | `day_one_minute_left.mp3` | *"Perhatian... Waktu diskusi tersisa satu menit lagi."* |
| `VOTING_START` | `voting_start.mp3` | *"Waktu diskusi habis! Silakan pilih satu nama di layar HP kalian untuk dieksekusi sekarang."* |
| `VOTE_TIE` | `voting_tie.mp3` | *"Hasil voting seri! Para kandidat yang seri memiliki waktu tiga menit untuk membela diri... sebelum voting ulang dimulai."* |
| `EXECUTION_RESULT` | **Microsoft on demand** (fallback `execution_result.mp3`) | *"Warga desa telah memutuskan... {executedName} dieksekusi hari ini!"* |
| `NO_EXECUTION` | `execution_none.mp3` | *"Voting kembali seri... Tidak ada warga yang dieksekusi hari ini."* |
| `WIN_*` | `win_villager/werewolf/tanner/lovers.mp3` | One line per winning side. |

Exact texts: `src/games/werewolf/voice/voice-pack.json` (static) and `NAME_LINES` in `src/games/werewolf/voice/templates.ts` (named).

### 1.2b Adding a voiced role (checklist)
Only roles that **wake at night** (`NIGHT_ORDER`) or end the game need a voice line; Hunter has its revenge line, and Tanner, Lycan, Cursed, Minion, Mayor, and Disease need none because nothing is spoken for them. Today the voiced night roles are Cupid, Mason, Werewolf, Guardian Angel, Seer, and Witch, and every winning faction (Villager, Werewolf, Tanner, Lovers) has a win line. To add another one:
1. Add the role in `contract.ts` (`CLASSIC_ROLES` plus `BASE_ROLES` or `TWIST_ROLES`) and `roles.ts`; for a night role also `NIGHT_ORDER` and the engine turn.
2. Add `CLASSIC_TURN_<ROLE>` (or `CLASSIC_WIN_<FACTION>`) to `voice/voice-pack.json` with `text` and an emotional `elevenlabsText`, and map it in `TURN_KEYS` / `WIN_KEYS` in `voice/templates.ts`.
3. Generate the ElevenLabs MP3 with `docker compose run --rm --no-deps web npm run voice:generate -- --only CLASSIC_TURN_<ROLE>` (default), then generate the Microsoft MP3 with the same command plus `--provider microsoft`; commit both files.
4. `voice/voice-coverage.test.ts` fails until the role has its own turn line (not the end-of-turn fallback) and every pack line exists as an MP3 for both voices.

### 1.3 Mode 2: ONUW voice-only night (`/audio/werewolf/onuw/`, split open/close clips)
The phone in the center plays `*_open.mp3`, shows the countdown ring (10–14 s), then plays `*_close.mp3`:
- Intro: `onuw_intro.mp3`
- Werewolf (12 s), Minion (10 s), Mason (10 s), Seer (14 s), Robber (14 s), Troublemaker (14 s), Drunk (12 s), Insomniac (10 s): `<role>_open.mp3` → countdown → `<role>_close.mp3`
- Day start: `onuw_day_start.mp3`
- Final pointing countdown: `onuw_vote_countdown.mp3`

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
