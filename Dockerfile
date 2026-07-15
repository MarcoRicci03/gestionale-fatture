# syntax=docker/dockerfile:1

# ---------------------------------------------
# Stage 1: Builder
# ---------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Strumenti necessari per compilare moduli nativi (better-sqlite3)
RUN apk add --no-cache python3 make g++ libstdc++ libc-dev

COPY package.json package-lock.json* ./
RUN npm ci

# Prisma: schema + config per generare il client
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL="file:./build.db"
RUN npx prisma generate

# Copia sorgenti e builda Next.js in modalità standalone
COPY . .
RUN npm run build

# Rimuove le devDependencies per alleggerire l'immagine finale
RUN npm prune --omit=dev

# ---------------------------------------------
# Stage 2: Runner
# ---------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Libreria runtime necessaria ai moduli nativi compilati
RUN apk add --no-cache libstdc++

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/dev.db"

# Directory per il volume SQLite
RUN mkdir -p /app/data

# Copia l'applicazione standalone e le dipendenze di produzione
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "server.js"]
