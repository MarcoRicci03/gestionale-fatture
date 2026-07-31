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
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
# Serve solo perché lib/auth/jwt.ts valida il segreto al caricamento del
# modulo e farebbe fallire `npm run build`: questo valore non deve MAI finire
# in produzione (lo stage "runner" sotto non eredita questo ENV, quindi un
# container avviato senza JWT_SECRET reale in .env.prod non parte affatto).
ARG JWT_SECRET="build-only-placeholder-not-a-real-secret-do-not-copy-0000000000"
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
RUN npm run build

# Rimuove le devDependencies per alleggerire l'immagine finale
RUN npm prune --omit=dev

# ---------------------------------------------
# Stage 2: Runner
# ---------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# openssl: per eseguire l'engine di Prisma al runtime.
# tzdata: senza il database dei fusi, Node su Alpine ignora TZ e resta su UTC
# (vedi LOG-12 sotto).
RUN apk add --no-cache openssl tzdata

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# LOG-12: pinna il fuso del processo a Europe/Rome. Gli aggregati fatturato
# (lib/data/invoices.ts) e la costruzione delle date (lib/utils/date.ts) usano
# new Date(anno, mese, ...) in ora locale del processo: senza questo, il
# container girerebbe in UTC mentre il client è in Europe/Rome, e la stessa
# fattura potrebbe cadere in un mese/anno diverso tra i due.
ENV TZ=Europe/Rome

# Utente non privilegiato: node.js non deve girare come root nel container
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Copia l'applicazione standalone e le dipendenze di produzione
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Necessaria per il servizio "audit-log-retention" (SEC-12): senza questa,
# scripts/audit-log-retention.mjs non sarebbe raggiungibile a runtime. I
# file .test.ts restano inerti (mai eseguiti da `node` direttamente).
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copia la cartella Prisma e la config per eseguire le migrazioni in produzione
# (prisma.config.ts è la fonte del datasource.url in Prisma 7: senza questo file
# "prisma migrate deploy" fallisce con "datasource.url property is required",
# a prescindere dall'utente con cui gira il container)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs

EXPOSE 3000

# Esegue prima le migrazioni su Postgres, poi avvia Next.js
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
