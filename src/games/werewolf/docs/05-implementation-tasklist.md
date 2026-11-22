# 05 — Implementation Tasklist (PartyQuest adaptation)

Work through the phases in order. Mark each item `[x]` once it is implemented and verified (Vitest, typecheck, lint, build in Docker). Rules come from files 01–03; architecture from file 04.

## Phase 1: Pure engines and roster data
- [x] **1.1** `contract.ts` and `roles.ts`: roles, alignments, phases, settings, Indonesian descriptions, art prompts, recommended composition (5–16 players).
- [x] **1.2** `engine/classic`: state machine from file 02 §1.1 with night priority order, fixed turn windows, and `phaseDeadlineAt`.
- [x] **1.3** Night resolution: Werewolf kill (majority/consensus), Doctor protection (no consecutive repeat), Seer (Lycan reads as Werewolf, Minion as Villager), Witch heal/poison (once each), Cupid lovers chain death, Cursed conversion, Disease blocking the next night's kill.
- [x] **1.4** Day: hidden votes, simultaneous reveal matrix, Mayor 2×, abstain, `TIE_DEFENSE` → `TIE_REVOTE` → no execution on a second tie; `HUNTER_REVENGE` after night or day death.
- [x] **1.5** AFK: role promotion of a random eligible online Villager, strike 1 (`canVote = false`), strike 2 (`DEAD_AFK`, does not use the day's execution).
- [x] **1.6** Win check: Tanner override, Lovers (final two), Villager (no Werewolves), Werewolf parity.
- [x] **1.7** `engine/onuw`: deck validation (`ΣS(r) = N` and `S(r) ≤ D(r)`, mismatch list, names preserved) and the night sequencer script with per-role durations.
- [x] **1.8** Vitest coverage for every rule above, including invalid phase/turn/actor and dead-player rejections.

**Naming:** the Doctor role is shown and voiced as **Guardian Angel** (internal id stays `DOCTOR`; decided 2026-11-23).

**Phase 1 decisions where the spec was silent or inconsistent** (implemented and tested):
- Wolf target = plurality of alive Werewolves' picks; an even split means no attack. Werewolves cannot target Werewolves.
- `NIGHT_INTRO` lasts 6 s and `OPEN_VOTING` 60 s (the spec names no durations for these).
- Night turns stay in the queue when holders are dead, Werewolves are diseased, or the Witch has no potions, so pacing never leaks.
- Hunter shots resolve before the win check; Tanner execution overrides everything.
- Any active night role may `SKIP` deliberately; only holders who could act are struck as AFK. Strike 2 = AFK again while strike 1 is active; the struck player keeps their role (no promotion). Strike 1's vote ban covers the next day's voting (including a revote) and clears afterwards.
- A promoted Villager acts from the next turn; Witch potions are game-wide, so they carry over.
- Recommended composition fills remaining seats with Villagers, because the spec's Villager ranges for 10–16 players do not add up.
- Seer: Lycan reads as Werewolf; Minion and an unconverted Cursed read as Villager. Cupid may link themselves.

## Phase 2: Platform extensions (file 04 §8)
- [x] **2.1** Migration: `game_key` adds `werewolf`; `max_players`/`seat_no` up to 16; `create_room` takes `max_players`.
- [x] **2.2** `OnlineGameServer`: actor `{ userId, isHost }`, `retryOnConflict`, `publicView`; update Undercover's adapter and tests.
- [x] **2.3** Lobby settings editor (`GameModule.RoomSettingsEditor`) and host-only `PATCH /api/rooms/[code]/settings`.
- [x] **2.4** Presence via `room_members.last_seen_at`.
- [x] **2.5** DB integration tests for the new migration and settings route.

**Phase 2 notes:** `apply_game_action` also persists secret state (Werewolf changes it on every action). Changing settings resets other players' ready state. Presence counts a member online when seen within 30 s (`PRESENCE_WINDOW_SECONDS`). Undercover votes now use retry-on-conflict too.

## Phase 3: Classic online adapter
- [x] **3.1** `server/online.ts`: settings schema (roster, twist toggles, `deadRevealMode`, timers), `createRound`, intents from file 04 §4, `advance` for every timed phase.
- [x] **3.2** Per-player `view` with the privacy rules in file 04 §6; `publicView` for the TV.
- [x] **3.3** Register in `src/games/online-registry.ts`; adapter tests for privacy, spoofed actors, dead players, host-only force advance.

**Phase 3 notes:** Room settings accept `roles: "AUTO"` (recommended composition for the final player count, the default) or a custom composition checked against the real count at start. The role composition is public (like a deck on the table); death causes are shown only as EXECUTION / HUNTER / DEAD_AFK / NIGHT so poison or heartbreak never reveal roles; AFK promotions are removed from the public log. Commutative intents retry up to 20 times with jittered backoff (verified with simultaneous votes in a live room).

## Phase 4: Classic UI
- [x] **4.1** `index.ts` GameModule, catalog card, `/games/werewolf` setup (Mode 1 create/join; Mode 2 shown as "segera hadir" until Phase 6), `werewolf.css` theme, host lobby settings editor.
- [x] **4.2** Flip role card with description and alignment badge; ready flow.
- [x] **4.3** Dark Outline Night UI (`#000000`, low-luminance outlines, no white surfaces) and the `GILIRANMU` action panel with a 200 ms fade.
- [x] **4.4** Fake Tap mini-game for alive players outside their turn; passive Dead/Spectator view for eliminated players.
- [x] **4.5** Day discussion countdown, open voting, reveal matrix, tie defense/revote, Hunter target picker, Host `Paksa Lanjut`.
- [x] **4.6** Game over: winner, full roles, lovers, match timeline; rematch through the platform lobby.

**Phase 4 notes:** Verified by unit tests, typecheck, lint, production build, and API/page checks on the local server. A hands-on multi-device browser run is still pending (Phase 7.2). Each client refetches its view right after the server deadline, so phases advance on server time.

## Phase 5: Voice moderator
- [x] **5.1** Voice lines: the 41-line voice pack (`voice/voice-pack.json`, MP3 in `public/audio/werewolf/`, generated with Microsoft Edge Neural Ardi) plus four named daytime announcements (`NAME_LINES`).
- [ ] **5.2** `voice/narrator.ts`: queue, audio unlock, Wake Lock, static clips first, **Microsoft Edge Neural** for named lines from the server (`/api/games/werewolf/tts`, named templates only, host-only, disk cache), generic clip and Web Speech fallbacks, narration on the host's phone *(done)*; single-source lock driven by `audioOutput` once a TV can be paired *(pending, Phase 7)*.

## Phase 6: ONUW local mode
- [x] **6.1** Host deck builder (`N` = 3–10 players, `N + 3` cards).
- [x] **6.2** Pass-the-phone registration with every configured role at full opacity; re-pick flow on mismatch that keeps names.
- [x] **6.3** Voice-only night with countdown rings, day timer, and the `3-2-1` pointing prompt; optional post-game log.

**Phase 6 notes:** Route `/games/werewolf/onuw`, client-only (no server). Recommended N + 3 decks with per-role limits (Masons in pairs); every configured role is always shown at full opacity; a mismatch keeps names and every player re-picks; the night plays the voice pack (open, countdown ring, close) for every deck role, then the day timer and the 3-2-1 pointing line. Verified by unit tests, typecheck, lint, and page checks; a hands-on run with physical cards is still pending.

## Phase 7: TV screen and verification
- [ ] **7.1** TV pairing code, read-only TV token, `/games/werewolf/tv` and `/games/werewolf/tv/[code]` stage (player ring, countdown, vote breakdown, subtitle bar).
- [ ] **7.2** README, AGENTS.md, UI style guide updates; `npm test`, typecheck, lint, production build, and a multi-device run in Docker.
