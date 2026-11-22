# 01 — Product Requirements Document (PRD): Overview & Dual-Mode Flows

> **PartyQuest adaptation:** This file keeps the original Werewolf Hybrid spec wording. Stack references were mapped to the PartyQuest platform (guest cookie, PostgreSQL, SSE). See `04-architecture-and-platform-integration.md` for how each item is implemented.

## 1. Product Vision & Goals
**Werewolf Hybrid** solves two classic pain points of playing Werewolf in person:
1. Nobody wants to sit out as the human moderator.
2. Human moderators accidentally reveal roles through vocal inflection, eye gaze, or inconsistent timing.

By combining an automated **AI Voice Moderator** with **anti-tell mobile interfaces**, players stay immersed in face-to-face social deduction while the web app enforces rules, timers, role abilities, and audio narration accurately.

---

## 2. Target User Personas & Device Roles
- **Room Host (`HOST`):** Creates the room, configures game mode & role roster, holds the primary phone (audio output when no TV is present), holds emergency phase-skip controls (`Paksa Lanjut`), and **also plays as a regular participant**.
- **Participant (`PLAYER`):** Joins via QR scan or Room Code on their smartphone, views their secret role card, performs night actions (or fake taps while alive), and votes during the day.
- **Shared Display (`TV_SCREEN` — Optional in Mode 1):** A Smart TV, tablet, or laptop browser connected to `/games/werewolf/tv/[roomCode]` showing the public stage, live countdowns, AI narration subtitles, player status grid, and open voting breakdown.

---

## 3. Mode 1: Hybrid Classic Werewolf (Multi-Night)

### 3.1 Room Setup & Pairing Flow
1. **Create Room:** Host selects **Mode 1: Hybrid Classic**, enters their nickname, and receives a 6-character `roomCode` + scannable QR code.
2. **Player Onboarding (No Login):** Players scan the QR code, enter a nickname, and land in the Lobby. The PartyQuest guest session (signed HttpOnly `pq_guest` cookie) identifies the player, so reopening the page reconnects them to their seat.
3. **Optional TV Pairing:** A TV/Laptop opens `/games/werewolf/tv` and either scans the TV-pair QR or types the 6-character `roomCode` plus the Host-issued pairing code. Once paired with a room-scoped, read-only TV token, the room sets `hasTvScreen = true` and transfers TTS audio output from the Host's phone to the TV.
4. **Lobby Configuration (Host Controls):**
   - **Player Count:** 5 to 16 players.
   - **Role Composition:** System auto-populates a balanced roster based on player count (see `02-GAME-RULES-AND-ROSTERS.md`), while allowing Host `+ / -` adjustments and Twist Role toggles.
   - **Dead State Mode Toggle (Read-Only Role Visibility):**
     - `SPECTATOR_REVEAL`: Eliminated players see a passive spectator screen displaying all other players' roles (read-only) so they can follow the match without boredom.
     - `KEEP_HIDDEN`: Eliminated players see a passive *"Kamu Telah Tereliminasi"* screen where all other players' roles remain secret until `GAME_OVER`.
     - **Zero Night Interaction:** In **both** modes, eliminated players **cannot interact during the Night Phase** (no Fake Tap mini-game and no night actions) and cannot vote during the Day Phase.
   - **Timers:** Configurable Night Turn duration (default: `15s` per active role) and Day Discussion duration (default: `180s`).

### 3.2 Core Gameplay Loop (Mode 1)
1. **Role Distribution:** All players tap to flip their digital role card (displaying illustration, role name, alignment, and 1-paragraph ability summary), then tap *"Siap"* (Ready).
2. **Night Phase (Dark Outline UI):**
   - AI Moderator announces nightfall.
   - Every **alive** player's screen switches to `#000000` black with dim glowing outlines.
   - Active roles are called sequentially using **fixed equal time windows** (`15s` each). Only the active alive role(s) see `"GILIRANMU"` and target buttons; all other **alive** players (including Villagers and alive roles waiting/finished) perform continuous **Fake Tap** circle sequences.
   - **Eliminated Players:** Remain on their passive, non-interactive Dead/Spectator screen (no Fake Tap mini-game, no prompts).
3. **Dawn & Morning Announcement:**
   - AI announces who died overnight (or if no one died / Werewolves were blocked by Disease/Doctor).
   - If `Hunter` died, game pauses briefly for `HUNTER_REVENGE` target selection.
   - Win conditions are checked immediately.
4. **Day Discussion & Open Voting:**
   - Verbal face-to-face discussion runs until the countdown hits `0` (or majority votes to skip discussion early).
   - **Open Voting:** Alive eligible players select a suspect on their phones. Choices stay hidden while voting is active, then **reveal simultaneously** showing every voter and their chosen target.
   - **Tie-Breaker:** If two or more suspects tie for highest votes, they enter a `30s` defense speech countdown followed by a **Re-vote** restricted to the tied candidates. If the re-vote ties again, no one is executed.
5. **Loop / Game Over:** Repeat Night -> Day until a faction meets its victory condition, culminating in a full role-reveal & match timeline screen.

---

## 4. Mode 2: One Night Ultimate Werewolf / ONUW (1-Night, Physical Cards)

### 4.1 Concept & Setup Flow
Mode 2 acts as an **anti-cheat deck validator and AI audio moderator** for players using physical ONUW cards and **1 shared smartphone**.
1. **Deck Configuration (Host):**
   - Host enters total player count $N$ (3 to 10 players) and inputs the exact composition of the **$N + 3$ physical cards** in play (where $N$ cards are dealt to players and 3 cards remain face-down in the center of the table).
2. **Pass-the-Phone Anti-Cheat Registration:**
   - Players pass the single phone around the table one by one.
   - Each player types their **Nickname** and taps the **Role Card** matching the physical card in their hand.
   - **Anti-Cheat Visibility:** Every role configured by the Host remains visible and selectable for every player—previously chosen roles are **never** greyed out or marked taken.
   - Once all $N$ players submit, the backend compares selected role counts against the Host's $N + 3$ deck:
     - **Valid:** Every selected role count is $\le$ the deck count (leaving exactly 3 unpicked cards in the center). Proceeds to Night Phase.
     - **Invalid / Cheating Detected:** System alerts *"Terjadi ketidaksesuaian jumlah kartu role!"* and requires **all players** to re-select. **Registered player names are preserved**—each player simply taps their existing name from the list and selects their role card again.

### 4.2 Gameplay Loop (Mode 2 — Voice-Only Night)
1. **Center-Table Placement:** Phone is placed untouched in the center of the table. Screen displays a static dark moon countdown screen.
2. **AI Voice-Only Night:**
   - AI Moderator reads the deterministic ONUW wake-up order, pausing `10–15 seconds` per role while players physically look at or swap cards on the table (e.g., *"Seer, buka mata dan lihat kartu satu pemain lain atau dua kartu di tengah meja... [12s countdown] ... Seer, tutup mata"*).
   - Roles not present in the $N + 3$ deck are skipped automatically by the AI script.
3. **Day Discussion & Physical Simultaneous Pointing:**
   - AI announces morning. Players debate for the configured timer (e.g., `3–5 minutes`).
   - At the final `3-2-1` countdown, AI commands *"Tunjuk target kalian sekarang!"* and players physically point at the person they vote to eliminate.
   - Optional Post-Game Reveal button on the phone lets players log who was eliminated and verify final card positions.

---

## 5. Resilience, Reconnect & Host Controls
- **Auto-Reconnect:** If a player closes their browser, loses signal, or locks their phone during Mode 1, reopening the URL automatically restores their session through the guest cookie and refetches the active phase state from the server.
- **Host Force-Advance (`Paksa Lanjut`):** Available on the Host's phone whenever a phase or player action stalls beyond `20s` (or immediately if a player shows `OFFLINE`).
