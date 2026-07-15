# syntax=docker/dockerfile:1

# ---------------------------------------------
# Stage 1: Builder
# ---------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# L'engine di Prisma richiede openssl su Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

# Prisma: schema + config per generare il client
COPY prisma ./prisma
COPY prisma.config.ts ./
# (Il generatore di Prisma non ha bisogno di un URL reale durante la build)
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

# Necessario per eseguire l'engine di Prisma al runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copia l'applicazione standalone e le dipendenze di produzione
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copia la cartella Prisma per eseguire le migrazioni in produzione
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Esegue prima le migrazioni su Postgres, poi avvia Next.js
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]