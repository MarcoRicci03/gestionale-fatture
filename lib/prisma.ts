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
};

// Limiti espliciti sul pool: senza `max`, `pg` non impedisce di aprire
// connessioni fino a saturare `max_connections` lato Postgres sotto carico o
// leak di connessioni; `idleTimeoutMillis`/`connectionTimeoutMillis` evitano
// che connessioni inattive restino aperte indefinitamente o che una query
// resti bloccata a tempo indeterminato se il DB non risponde.
const pool = new Pool({
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