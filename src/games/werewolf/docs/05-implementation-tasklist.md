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
- [x] **4.7** `Daftar role (25)` on `/games/werewolf`: modal with 3D flip cards grouped by side (Warga, Jahat, Netral), Game-Icons.net emblems (CC BY 3.0, credited), one-sentence ability on the back. The 14 roles the engine deals are playable; Apprentice Seer, Prince, Troublemaker, Spellcaster, Lone Wolf, Vampire and the wolf-side Alpha Wolf, Sorcerer, Wolf Cub, Dire Wolf and Dream Wolf are shown with a "Segera" tag until Phase 8 lands.

**Phase 4 notes:** Verified by unit tests, typecheck, lint, production build, and API/page checks on the local server. A hands-on multi-device browser run is still pending (Phase 7.2). Each client refetches its view right after the server deadline, so phases advance on server time.

## Phase 5: Voice moderator
- [x] **5.1** Voice lines: the 41-line voice pack (`voice/voice-pack.json`, MP3 in `public/audio/werewolf/`, generated with Microsoft Edge Neural Ardi) plus four named daytime announcements (`NAME_LINES`).
- [x] **5.2** `voice/narrator.ts`: queue, audio unlock, Wake Lock, static clips first, **Microsoft Edge Neural** for named lines from the server (`/api/games/werewolf/tts`, named templates only, host-only, disk cache), generic clip and Web Speech fallbacks, narration on the host's phone *(done)*; single-source lock: the paired TV narrates while connected, otherwise the host phone *(done in Phase 7)*.

## Phase 6: ONUW local mode
- [x] **6.1** Host deck builder (`N` = 3–10 players, `N + 3` cards).
- [x] **6.2** Pass-the-phone registration with every configured role at full opacity; re-pick flow on mismatch that keeps names.
- [x] **6.3** Voice-only night with countdown rings, day timer, and the `3-2-1` pointing prompt; optional post-game log.

**Phase 6 notes:** Route `/games/werewolf/onuw`, client-only (no server). Recommended N + 3 decks with per-role limits (Masons in pairs); every configured role is always shown at full opacity; a mismatch keeps names and every player re-picks; the night plays the voice pack (open, countdown ring, close) for every deck role, then the day timer and the 3-2-1 pointing line. Verified by unit tests, typecheck, lint, and page checks; a hands-on run with physical cards is still pending.

## Phase 7: TV screen and verification
- [x] **7.1** TV pairing code, read-only TV token, `/games/werewolf/tv` and `/games/werewolf/tv/[code]` stage (player ring, countdown, vote breakdown, subtitle bar).
- [ ] **7.2** README, AGENTS.md, UI style guide updates; `npm test`, typecheck, lint, production build, and a multi-device run in Docker.

**Phase 7 notes:** Host creates a 6-digit pairing code in the lobby (10 minutes, single use); the TV trades it at `/games/werewolf/tv` for a random token stored only as a SHA-256 hash (HttpOnly cookie, 12 h). `/games/werewolf/tv/[code]` polls the public view every 2.5 s (no roles until game over) and narrates after "Aktifkan suara"; while a TV has polled within 30 s, `tvConnected` silences the host phone. The TTS route accepts the host or a TV paired to that room. Live subtitle bar and animated vote arrows are not implemented yet (see CHANGELOG). 7.2 (multi-device hands-on run) is still open.

## Phase 8: New twist roles and their role calls (voice)
The eleven roles below appear on the role cards (4.7) but are not in `CLASSIC_ROLES` yet. Voice work depends on the engine work, so do 8.1 first. Voice lines follow the existing rules: static lines are the committed voice pack, only the named daytime announcements are synthesized on demand, night turn lines name roles only, and the generic-clip and Web Speech fallbacks stay.

- [ ] **8.1** Engine and roster: add `APPRENTICE_SEER`, `PRINCE`, `TROUBLEMAKER` (classic twist: one double execution vote), `SPELLCASTER`, `LONE_WOLF`, `VAMPIRE` and the wolf-side roles below to `contract.ts`, `roles.ts` (name, alignment, description, max copies), the night priority order, night resolution, win check (Lone Wolf wins alone; Vampire as a neutral win), settings schema, recommended composition, and Vitest for every rule. Decide how the classic Troublemaker relates to the ONUW Troublemaker that already exists.
- [ ] **8.1b** Wolf-side role mechanics (all Jahat, same win condition as the Werewolves):
  - `ALPHA_WOLF`: extra toggle "Ubah jadi Werewolf (1x)" on the Werewolf attack screen; once per game the night victim becomes a Werewolf instead of dying.
  - `SORCERER`: wakes every night with a Seer-style reading screen, but the result only says "Seer" or "Bukan Seer".
  - `WOLF_CUB`: if it is eliminated at any time, the Werewolves may pick two victims the following night (the attack quota doubles automatically).
  - `DIRE_WOLF`: picks one secret partner on the first night; when the partner dies the Dire Wolf is eliminated at once.
  - `DREAM_WOLF`: does not wake at night (no night action screen) but appears in the other Werewolves' teammate list.
  Decide the interaction rules (Seer reads, Lone Wolf and Alpha conversion, lovers chain, win checks) and cover each with Vitest.
- [ ] **8.2** Night role calls (open and close, like the existing `CLASSIC_TURN_*` lines) in `voice/voice-pack.json`: `CLASSIC_TURN_SPELLCASTER`, `CLASSIC_TURN_VAMPIRE`, `CLASSIC_TURN_APPRENTICE_SEER` (called only after the Seer died, but still paced so the call never leaks who died). Lone Wolf wakes with the Werewolves, so extend the Werewolf call instead of adding a separate one. Wolf-side roles: `CLASSIC_TURN_SORCERER` (own call), a first-night `CLASSIC_TURN_DIRE_WOLF` partner-pick call, Alpha Wolf acts inside the Werewolf call (its toggle must not change the line), and Wolf Cub and Dream Wolf get no call; keep silent paced turns for Dream Wolf so pacing never leaks that it sleeps. Lines name roles only.
- [ ] **8.3** Day announcements as named templates (`NAME_LINES`, synthesized on demand, host-only, covered by `isAllowedNarration`): Prince revealed and the execution cancelled, Troublemaker's second vote, the player silenced by the Spellcaster, and a Vampire victim doomed for the next vote. Never announce an Alpha Wolf conversion or a Dream Wolf; a Dire Wolf's partner-death is announced as an ordinary death.
- [ ] **8.4** Edge Neural generation: add the lines to the voice pack source and run `npm run voice:generate` to commit the MP3 files in `public/audio/werewolf/`; keep the Ardi voice and the active preset.
- [ ] **8.5** ElevenLabs: make `TTS_PROVIDER=elevenlabs` voice the new static and named lines with the existing presets and dramatic effects; the key stays in the runtime server env only (never `NEXT_PUBLIC_`, never a build arg, never committed) and any failure falls back to Microsoft.
- [ ] **8.6** Bilingual option: add the new English role names (Apprentice Seer, Prince, Spellcaster, Lone Wolf, Vampire, Alpha Wolf, Sorcerer, Wolf Cub, Dire Wolf, Dream Wolf) to `bilingual.englishTerms` in `voice-pack.json` so they are pronounced correctly.
- [ ] **8.7** Narration wiring and tests: map each new role and event to its voice key in `ui/narration.ts` (host device or TV only, never both), extend `narration.test.ts` and the voice route tests (allowed templates, host-only, fallback), and verify Edge and ElevenLabs on the TV and host device.
- [ ] **8.8** Docs: update `02-game-rules-and-rosters.md` (roster, night order, win rules), `03-ai-voice-and-ux-specs.md` (new calls and durations), AGENTS.md and the README; then remove the `Segera` tag from the role cards.
