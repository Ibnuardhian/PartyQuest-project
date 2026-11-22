# AGENTS.md

## Project Overview

PartyQuest is a lightweight multiplayer web game for **Undercover / Tebak Kata**.

The MVP supports:
- Pass-and-Play using one device.
- Online multiplayer with each player using their own device.
- Guest access without email or password registration.
- Local development using Docker.
- Deployment to Vercel with a managed PostgreSQL database for online multiplayer.

## Technology Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Plain PostgreSQL through `pg` (server-only); no Supabase
- Signed HttpOnly guest cookies for anonymous auth
- Postgres `LISTEN/NOTIFY` relayed to browsers with Server-Sent Events
- Docker and Docker Compose
- Built-in unit testing capabilities of the selected test runner

Do not introduce additional frameworks or dependencies unless required and justified.

## Engineering Principles

1. Inspect the existing codebase before modifying files.
2. Prefer small, focused changes over unnecessary rewrites.
3. Keep game rules independent from React components, the database, and network APIs.
4. Reuse the same game engine for Pass-and-Play and online multiplayer.
5. Keep TypeScript strict and avoid `any` unless unavoidable and documented.
6. Validate all external input and game actions.
7. Never trust client-submitted game state.
8. Never expose secret words or another player's private information.
9. Avoid premature abstractions and unnecessary dependencies.
10. Preserve existing working functionality.

## Game Module Architecture

PartyQuest is a multi-game platform. Keep each game self-contained in `src/games/<game>/`:
- Rules/engine, word data, local session, server adapter (`server/`), UI (`ui/`, including the game's theme CSS), and `index.ts` exporting a `GameModule`.
- Register UI modules in `src/games/registry.ts` and online adapters (`OnlineGameServer`) in `src/games/online-registry.ts`.
- Platform code (`src/components/catalog`, `src/components/lobby`, `src/components/site`, `src/lib`, `src/app/api`) must not contain game rules or game-specific labels; it reaches games only through these contracts.
- A new online game also needs its `game_key` allowed by a migration.

## Game Rules

Implement one original Undercover game with configurable player counts and word categories. The selected voting tie rule is one revote among tied players; a second tie ends that voting without elimination and starts a new clue round. Mr. White wins immediately by correctly guessing the Civilian word after elimination. Civilians win when no Undercover or Mr. White remains; Undercover wins when its living count is at least the living Civilian count. Mr. White does not count as an Undercover for that threshold.

For Pass-and-Play, clue, discussion, and voting happen verbally offline. Use one maximum-three-minute clue-round timer, store no clue turns/content or votes, and let players confirm the eliminated player in the app. Online Room retains turn-based clues and in-app voting/revote. The private Pass-and-Play reveal shows the word without a role label; reveal roles only when the game is finished (except the Mr. White guess mechanic after elimination).

The game should support:
- Civilian players sharing one secret word.
- Undercover players receiving a different but related word.
- An optional Mr. White role, if included in the implemented rules.
- Private word reveal.
- Player clue turns.
- Voting and elimination.
- Role-specific victory conditions.
- Round progression and game-over results.
- Rematch.

Keep the role distribution and victory conditions in one authoritative rules module. Document all implemented rules and edge cases.

## Multiplayer Security

- Authenticate online guests with the server-issued `pq_guest` cookie (HttpOnly, HMAC-SHA256 signed with `GUEST_SESSION_SECRET`, 30-day max age) backed by a `guest_users` row.
- Derive the acting user only from the verified cookie; never accept a browser-supplied user id or full game state.
- Validate room membership, phase, turn, and permitted actions on the server.
- Keep private words in server-controlled private state.
- Return only the information authorized for the requesting player.
- Never send private words through NOTIFY or the SSE stream.
- Database access goes through server-only modules (`src/lib/db`, `src/lib/rooms`). The browser never connects to PostgreSQL; `DATABASE_URL` and `GUEST_SESSION_SECRET` stay server-only.
- Migrations revoke `PUBLIC` privileges on tables and functions. Mutations run through PL/pgSQL functions that lock rows and re-validate host, membership, phase, and player counts.
- Verify the guest cookie and active membership before reading private state or running a mutation.
- The session view returns one player's private assignment; reveal all assignments only after the engine ends the game. NOTIFY/SSE events carry only the room id as an invalidation signal.
- Compare `expectedVersion` while locking the session row before persisting a server-computed public state.
- Persist the spoken-clue deadline in public session state, create it from server time, and advance expired turns through the same version-checked RPC. The browser timer displays the remaining server deadline; refreshing must not restart it.
- Preserve active membership during a running round so a transient disconnect can reconnect without stranding a turn; explicit leave is allowed from the lobby or after the round finishes.

## Ponytail and RTK

Before using Ponytail or RTK:
1. Check whether the tools are installed and available in the current environment.
2. Inspect their current documentation and repository instructions.
3. Use them only when compatible with the task and environment.
4. Do not assume local tool installations are available in cloud sessions.
5. Do not install extra tooling automatically without a clear need.

RTK may be used to reduce noisy terminal output when available. If unavailable, use ordinary shell commands with focused output.

Do not use the Agency Agents repository or introduce multi-agent orchestration for this MVP.

## Testing

Use the existing unit test runner or the smallest built-in-compatible option already available in the repository. This empty project uses Vitest as its single unit-test runner.

Prioritize tests for:
- Role distribution.
- Word assignment and privacy.
- Valid and invalid game actions.
- Voting and elimination.
- Victory conditions.
- Invalid phase transitions.
- Unauthorized player actions.
- State version conflicts in online mode.

Do not add Playwright, pgTAP, or another testing framework unless explicitly requested or technically necessary.

Run relevant unit tests, lint, type checking, production build, and Docker checks where supported by the project. Run Node and application dependencies in Docker; do not require local host Node/npm installations.

Never claim tests passed unless they were actually executed.

## Docker and Deployment

- Maintain a working Dockerfile and Docker Compose configuration for local development.
- Compose runs PostgreSQL (host loopback `POSTGRES_PORT`, default 5432) as the Online Room backend; `web` waits for it, runs `npm run db:migrate`, then starts Next.js.
- Keep secrets in environment variables.
- Provide `.env.example` containing variable names and safe placeholders only.
- Document local Docker setup and PostgreSQL configuration.
- Pass `DATABASE_URL` and `GUEST_SESSION_SECRET` as runtime environment values only, never as Docker build arguments.
- Migrations live in `db/migrations/` and are applied by `scripts/migrate.mjs` (one transaction per file, tracked in `schema_migrations`). `202611220001_initial_undercover.sql` defines 12-hour room expiry and `cleanup_expired_rooms()`; guest row retention is an operator policy.
- `LISTEN/NOTIFY` needs a direct or session-pooled connection; with transaction pooling, clients fall back to polling.
- Ensure the application can also be deployed to Vercel.
- Do not claim deployment is complete without verifying it.

## Documentation Maintenance

Whenever a feature is completed, a bug is fixed, or a significant architectural decision changes:

1. Update `AGENTS.md` if the project-wide instructions or architecture have changed.
2. Update the README if setup, commands, configuration, game rules, or deployment steps have changed.
3. Keep documentation concise and consistent with the actual implementation.

Do not mark a task complete while relevant tests are failing or required documentation is outdated.

## Token Efficiency

- Inspect only files relevant to the current task.
- Avoid repeatedly reading unchanged files.
- Use concise terminal output.
- Do not generate lengthy reports unless requested.
- Work in small, verifiable milestones.
- Report changed files, tests executed, results, and unresolved issues concisely.

## Definition of Done

A task is complete only when:
- The requested behavior is implemented.
- Relevant unit tests pass.
- Type checking and production build pass where supported.
- Security and privacy requirements remain satisfied.
- Relevant documentation is updated.
- Remaining limitations are explicitly reported.
