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
USER node
EXPOSE 3000
CMD ["node", "server.js"]
