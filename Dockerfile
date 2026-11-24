FROM node:24-alpine AS base
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
# ffmpeg is only for development tooling: the voice-pack generator trims and joins audio segments.
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
# Build tools (TypeScript, Tailwind/PostCSS) are devDependencies; NODE_ENV=production would skip them.
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Migrations run from the same image (`node scripts/migrate.mjs`); `pg` is already in the standalone node_modules.
COPY --from=builder --chown=node:node /app/db/migrations ./db/migrations
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
# Disk cache for generated narrator lines; mount a volume here to keep it across restarts.
RUN mkdir -p /var/cache/partyquest-tts && chown node:node /var/cache/partyquest-tts
ENV TTS_CACHE_DIR=/var/cache/partyquest-tts
USER node
EXPOSE 3000
CMD ["node", "server.js"]
