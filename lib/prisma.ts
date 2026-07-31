import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL non configurato nelle variabili d'ambiente");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool : Pool | undefined;
  shutdownRegistered: boolean | undefined;
};

// Limiti espliciti sul pool: senza `max`, `pg` non impedisce di aprire
// connessioni fino a saturare `max_connections` lato Postgres sotto carico o
// leak di connessioni; `idleTimeoutMillis`/`connectionTimeoutMillis` evitano
// che connessioni inattive restino aperte indefinitamente o che una query
// resti bloccata a tempo indeterminato se il DB non risponde.
//
// Riusa il Pool già in globalForPrisma invece di crearne uno nuovo a ogni
// valutazione del modulo (PERF-06): senza questo `?? `, ogni ricompilazione
// in sviluppo (hot-reload) creava un Pool che nessuno avrebbe mai usato (il
// PrismaClient cachato sotto continua a usare il primo) e sovrascriveva
// globalForPrisma.pool, rendendo quel riferimento inaffidabile per lo scopo
// per cui esiste — chiudere il pool.
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

// Senza un handler di shutdown, un SIGTERM (docker compose down, redeploy)
// termina il processo lasciando fino a `max` connessioni a Postgres da
// chiudere per timeout lato server invece che pulite. Solo in produzione:
// in sviluppo il dev server gestisce il proprio ciclo di vita, e qui non
// c'è comunque hot-reload a rieseguire questo blocco. La guardia su
// globalForPrisma.shutdownRegistered evita comunque listener duplicati sullo
// stesso segnale se il modulo venisse rivalutato più volte nello stesso
// processo.
if (process.env.NODE_ENV === "production" && !globalForPrisma.shutdownRegistered) {
  globalForPrisma.shutdownRegistered = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
      await prisma.$disconnect();
      await pool.end();
      process.exit(0);
    });
  }
}