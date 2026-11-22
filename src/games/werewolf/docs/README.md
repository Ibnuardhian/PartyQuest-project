# Werewolf — Game Blueprint (PartyQuest)

Source: "Werewolf Hybrid" PRD/spec bundle v3 (2026-11-22), adapted to the PartyQuest platform. The game rules, role rosters, voice scripts, and anti-tell UX come from the original specs. Architecture and stack follow PartyQuest. If a spec file conflicts with the root `AGENTS.md`, `AGENTS.md` wins.

## 1. Overview

Werewolf brings social deduction into a physical room without making one person sit out as moderator. An automated voice moderator and anti-tell phone screens enforce rules, timers, and abilities. One game folder (`src/games/werewolf/`) holds two engines:

1. **Mode 1: Hybrid Classic (multi-night, each player on their own phone).** Played through PartyQuest Online Room. Players join with the room code/QR. A TV/laptop shared screen is optional; without it, voice plays only on the Host's phone (the Host also plays). Night screens use the Dark Outline UI with Fake Taps for **alive** players only; eliminated players see a passive Dead/Spectator view. Day voting is open (simultaneous reveal), with tie defense + revote and AFK role reassignment.
2. **Mode 2: One Night Ultimate Werewolf / ONUW (physical cards + one shared phone).** Played locally on one device, like Undercover Pass-and-Play. Pass-the-phone registration validates picks against the Host's `N + 3` deck (all roles always shown at full opacity), then a voice-only night runs with 10–15 s countdowns.

## 2. Stack (adapted)

| Spec ("locked" stack) | PartyQuest implementation |
| --- | --- |
| Next.js 15 + custom `server.ts` with Socket.io | Existing Next.js App Router routes; no custom server (stays Vercel-compatible) |
| Socket.io + Redis adapter | Postgres `LISTEN/NOTIFY` → SSE invalidation (`/api/rooms/[code]/events`), then view refetch |
| Redis hot state, `NX` locks | Postgres row lock + `expectedVersion` compare-and-set (`apply_game_action`) |
| Drizzle ORM schema | Existing tables (`game_rooms`, `room_members`, `game_sessions`, `game_private_state`, `player_private_state`) + SQL migrations |
| `sessionToken` in localStorage/cookie | Signed HttpOnly `pq_guest` guest cookie |
| Caddy auto-HTTPS | Vercel HTTPS (or any TLS proxy for self-hosting) |
| OpenAI TTS + disk/Redis cache | Microsoft Edge Neural TTS (`node-edge-tts`) on the server with a disk cache; Web Speech API (`id-ID`) as fallback |
| Framer Motion, lucide-react | CSS transitions/keyframes and inline SVG (no new UI dependencies) |
| `qrcode.react`, `nanoid` | Room code from `src/lib/room-code.ts`; QR encoder is the only candidate new dependency (justify when implemented) |
| — | Vitest for all tests |

## 3. Guardrails (from the spec, adapted)

1. **Engine separation.** Classic and ONUW live in separate modules (`engine/classic/`, `engine/onuw/`) and share no state shapes. Do not mix multi-night health/protection with one-night card swaps.
2. **Server-authoritative state.** Every Classic mutation is a browser *intent* validated by the Werewolf adapter and persisted with the platform's version-checked mutation. The browser never sends game state, roles, or a player id.
3. **Narration.** Daytime announcements name players (victims, Hunter, executed player) as in the original templates; night turns name roles only, so nobody learns who holds a role. Voice is Microsoft Edge Neural TTS from the server (cached per line, template-only), with Web Speech as fallback.
4. **Single-source audio.** Only one device narrates: the paired TV when `hasTvScreen` is true, otherwise the Host's phone. Regular player phones never play voice lines.
5. **Dead players.** `isAlive === false` means no night interaction (no Fake Taps, no actions) and no day vote. The only exception is `HUNTER_REVENGE` right after a Hunter dies. `deadRevealMode` only controls read-only visibility: `SPECTATOR_REVEAL` shows all roles, `KEEP_HIDDEN` hides them until `GAME_OVER`.
6. **Zero role leakage.** Views are built per player by the adapter. Alive players see only their own role plus known teammates (Werewolves, Masons, and Werewolves for a Minion). Dead players see other roles only under `SPECTATOR_REVEAL`. The TV gets the public view only. Events carry no state.
7. **ONUW anti-cheat.** Pass-the-phone always renders every Host-configured role at full opacity, with no hint of earlier picks.

## 4. Specification index

1. `01-prd-overview-and-modes.md` — product scope, both mode flows, TV pairing, Dead State, reconnect.
2. `02-game-rules-and-rosters.md` — state machines, night order, AFK reassignment/penalties, tie-breaker, win conditions, full rosters with Indonesian descriptions and card-art prompts.
3. `03-ai-voice-and-ux-specs.md` — Indonesian voice templates, audio routing, Dark Outline Night UI, Fake Taps, TV layout.
4. `04-architecture-and-platform-integration.md` — how the specs map onto PartyQuest: state shape, intents, realtime, timers, privacy, TV, audio, required platform extensions.
5. `05-implementation-tasklist.md` — phased checklist; work through it in order.
