# 04 — Architecture & PartyQuest Platform Integration

Replaces the original spec's "System Architecture, Redis Caching, Socket.io & Database" (Oracle VPS + Docker Compose + Caddy + Redis + Socket.io + Drizzle + OpenAI TTS). The behavior in files 01–03 stays the same; only how it runs changes.

## 1. Where each mode runs

| Mode | Runs on | Persistence | Why |
| --- | --- | --- | --- |
| Mode 1 Classic | PartyQuest Online Room (guest cookie, rooms, platform lobby, `/api/sessions/*`) | PostgreSQL | Several phones need one authoritative state and private views. |
| Mode 2 ONUW | One device, client-only (like Undercover Pass-and-Play) | Tab `sessionStorage` | Cards are physical and the phone sits in the middle of the table; no server needed. Deck validation is a pure engine function. |

## 2. Folder layout

```
src/games/werewolf/
  docs/                      this spec set
  contract.ts                shared types (roles, alignments, phases, settings)
  roles.ts                   roster data, Indonesian descriptions, art direction
  engine/classic/            state machine, night resolution, voting, AFK, win check (pure)
  engine/onuw/               deck validation, night sequencer script (pure)
  voice/templates.ts         Indonesian voice templates for both modes
  voice/narrator.ts          client narrator: Web Speech id-ID, queue, single-source lock
  server/online.ts           OnlineGameServer adapter (settings, intents, advance, views)
  ui/                        setup, lobby settings editor, role card, night UI, fake taps,
                             voting, dead view, TV stage, ONUW pass-the-phone, werewolf.css
  index.ts                   GameModule for the platform
```

Pure engine code has no React, database, or network imports, and is covered by Vitest.

## 3. Classic state model

Stored with the existing session tables. Everything that could reveal a role or a hidden choice lives in **secret state**.

| Spec (Redis key / Drizzle column) | PartyQuest location |
| --- | --- |
| `room:{code}:state`, `rooms.*` config | `game_rooms.settings` (roster, `deadRevealMode`, timers) + `game_sessions.public_state` |
| players' `role`, `originalRole`, `alignment`, `isLover`, potions, Doctor's last target | `game_private_state.private_state` (secret) |
| per-player card shown on reveal | `player_private_state` (one row per player) |
| `room:{code}:night:{n}` night actions | secret state, current night only |
| `room:{code}:wolf:{n}` live wolf targets | secret state; shown only in alive Werewolves' views |
| `room:{code}:votes:{day}:{round}` | secret state while voting; copied into public state at reveal |
| `room:{code}:presence` | `room_members.last_seen_at`, refreshed by view requests |
| `isAlive`, `deathReason`, `canVote`, `hasAfkPenalty`, seat order | public state (alive status is public in this game) |
| `match_logs` | append-only `log` array in public state (dawn, execution, hunter, AFK events); full roles added at `GAME_OVER` |

Public state also holds `phase`, `nightNumber`, `dayNumber`, `phaseDeadlineAt` (server time), `activeNightRole`, `votedPlayerIds` (who has voted, never for whom), `tiedPlayerIds`, `hasTvScreen`, `audioOutput` (`"tv"` or `"host"`), and the `winner`.

## 4. Intents (replaces the Socket.io event contract)

The browser posts `{ expectedVersion, action }` to `/api/sessions/[id]/actions`. The adapter binds the acting player from the guest cookie.

| Spec event | Intent `type` | Notes |
| --- | --- | --- |
| `room:config` | — | Lobby settings editor (`PATCH /api/rooms/[code]/settings`, host-only, validated by `parseSettings`). |
| `room:start` | — | Existing `/api/rooms/[code]/start`. |
| `classic:ready` | `ready` | Night 1 starts when all alive players are ready. |
| `classic:wolf_preview` | `wolf-preview` | Alive Werewolf, during the Werewolf turn only. |
| `classic:night_action` | `night-action` | `{ actionType, targetId, secondaryTargetId? }`; validated against role, turn, and alive status. |
| (Hunter) | `hunter-shot` | Only in `HUNTER_REVENGE` by that Hunter. |
| `classic:vote` | `vote` | `{ targetId \| null }` for abstain; alive voters with `canVote` only. |
| `host:force_advance` | `force-advance` | Host only; applies AFK reassignment and the 2-strike penalty. |
| `onuw:register` | — | Client-only in Mode 2. |

Server → client events become: an SSE `changed` signal, then each device refetches its own view (`/api/sessions/[id]/view`). `wolf_sync`, `votes_revealed`, and `role_promoted` are fields of the next view, not separate payloads.

**Concurrent simultaneous actions.** Votes and night picks are commutative: many players submit at once. Instead of failing on `version_conflict`, the server reloads and reapplies these intents (up to 3 attempts) because each is validated against the latest state. See §8.

## 5. Timers

- Every timed phase stores `phaseDeadlineAt` from server time (night turns 15 s, discussion 180 s, tie defense 30 s, revote 20 s, Hunter 15 s, as configured).
- Night turns always use the fixed window, even when the role holder is dead or absent, so pacing never leaks.
- Deadlines advance through `OnlineGameServer.advance()` in the same version-checked mutation, exactly like Undercover clue turns. Each client schedules a view refetch at its displayed deadline; the first request after expiry advances the phase.
- Refreshing never restarts a timer. `Paksa Lanjut` is available to the Host after 20 s of a stalled phase, or immediately when a player is offline (no view request for 20 s).

## 6. Privacy rules (adapter `view`)

- Alive player: own role, known teammates (Werewolves see Werewolves; Masons see Masons from their Night 1 turn; Minion sees Werewolves), own Seer results, own Witch info (tonight's victim during the Witch turn).
- Dead player: same as alive, plus all roles when `deadRevealMode === "SPECTATOR_REVEAL"`. No night or vote controls.
- TV: public view only (§7).
- After `GAME_OVER`: full roles, lovers, and timeline for everyone.
- SSE and NOTIFY carry only the room id.

## 7. Shared TV screen

- The Host creates a pairing code in the lobby. A TV opens `/games/werewolf/tv`, enters room code + pairing code, and receives a random read-only TV token (stored hashed, scoped to one room, expiring with the room).
- `GET /api/rooms/[code]/tv` returns `publicView(session)`; the events stream also accepts the TV token.
- `hasTvScreen` is true while the TV has polled within the last 30 s; `audioOutput` follows it.

## 8. Required platform extensions

The current platform only fits Undercover. Before Mode 1:

1. **Migration**: allow `game_key in ('undercover','werewolf')`; raise `max_players` and `seat_no` limits to 16; let `create_room` accept a per-game `max_players`.
2. **`OnlineGameServer` contract**:
   - `applyIntent` receives `{ userId, isHost }` instead of `userId`.
   - Optional `retryOnConflict(intent)` for commutative intents (§4).
   - Optional `publicView(session)` for the TV.
   - Per-game `minPlayers`/`maxPlayers` already exist; the start route uses them.
3. **Lobby**: `GameModule.RoomSettingsEditor` (host-only) and `PATCH /api/rooms/[code]/settings`.
4. **TV token** table, pairing route, and SSE auth for TV clients.
5. **Presence**: update `room_members.last_seen_at` on view requests.

## 9. Voice

- Deterministic templates from `03-ai-voice-and-ux-specs.md` live in `voice/templates.ts`. Each device derives narration from phase transitions in its view, but only the designated output device (`audioOutput`) speaks.
- Default engine: Web Speech API, `id-ID` voice. The Host/TV taps "Mulai Permainan / Aktifkan Suara" to unlock audio; request `navigator.wakeLock` during play.
- **Deferred decision:** server TTS (OpenAI `tts-1`). Vercel has no persistent disk, so caching needs object storage. Adding it requires `OPENAI_API_KEY` (server-only), a storage choice, and a hash-keyed cache. Not part of the first implementation.

## 10. Out of scope for the first version

Card illustrations (keep the art prompts as direction; use CSS/SVG placeholders), animated TV vote arrows beyond CSS, server TTS, and an Oracle/Caddy deployment guide.
