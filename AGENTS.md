# AGENTS.md

## Project Overview

PartyQuest is a lightweight multiplayer web game for **Undercover / Tebak Kata**.

The MVP supports:
- Pass-and-Play using one device.
- Online multiplayer with each player using their own device.
- Guest access without email or password registration.
- Local development using Docker.
- Deployment to Vercel with Supabase for online multiplayer.

## Technology Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, and Realtime
- Docker and Docker Compose
- Built-in unit testing capabilities of the selected test runner

Do not introduce additional frameworks or dependencies unless required and justified.

## Engineering Principles

1. Inspect the existing codebase before modifying files.
2. Prefer small, focused changes over unnecessary rewrites.
3. Keep game rules independent from React components, Supabase, and network APIs.
4. Reuse the same game engine for Pass-and-Play and online multiplayer.
5. Keep TypeScript strict and avoid `any` unless unavoidable and documented.
6. Validate all external input and game actions.
7. Never trust client-submitted game state.
8. Never expose secret words or another player's private information.
9. Avoid premature abstractions and unnecessary dependencies.
10. Preserve existing working functionality.

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

- Authenticate online guests using Supabase anonymous sign-in.
- Derive the acting user from the verified server session.
- Validate room membership, phase, turn, and permitted actions on the server.
- Keep private words in server-controlled private state.
- Return only the information authorized for the requesting player.
- Never send private words through public Realtime broadcasts.
- Protect database tables with appropriate grants and Row Level Security policies.
- Never expose Supabase secret or service-role keys in client code.
- Use atomic state updates or equivalent concurrency control to prevent conflicting actions.
- Online database access goes through server-only Supabase code with the secret key. Verify the anonymous JWT and active membership before reading private state or running a mutation.
- Revoke direct `anon` and `authenticated` table grants as well as enabling RLS. Mutating RPCs are executable only by `service_role`; do not pass a browser-supplied user id or full game state to them.
- The session view returns one player's private assignment; reveal all assignments only after the engine ends the game. Realtime is an invalidation signal and contains no game/private state.
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
- Compose includes a local PostgreSQL development service on host loopback port 5432. It does not replace Supabase Auth or Realtime; the Online Room API still uses the configured Supabase project unless a separate backend migration is designed.
- Keep secrets in environment variables.
- Provide `.env.example` containing variable names and safe placeholders only.
- Document local Docker setup and Supabase configuration.
- Keep the Supabase secret key in runtime server environment only; Compose passes it as a runtime environment value and never as a Docker build argument.
- Migration `202610220001_initial_undercover.sql` defines 12-hour room expiry and the `cleanup_expired_rooms()` maintenance function. Anonymous Auth retention remains a Supabase project policy.
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
