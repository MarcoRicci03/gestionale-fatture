// Bootstrap del primissimo amministratore su un database vuoto.
//
// Non è un `prisma/seed.ts` invocato da `prisma db seed` di proposito: questo
// script deve poter girare anche dentro l'immagine di produzione, dove
// Dockerfile fa `npm prune --omit=dev` e rimuove tsx/CLI Prisma/dotenv. È
// quindi ESM puro che importa solo @prisma/client, @prisma/adapter-pg, pg e
// bcryptjs — tutte dipendenze di produzione già presenti nell'immagine.
//
// Idempotente: se esiste già un amministratore, non fa nulla. Rieseguirlo per
// errore non ha effetti collaterali.
//
// Uso:
//   node --env-file=.env prisma/seed.mjs                              (sviluppo)
//   docker compose -f docker-compose.prod.yml exec app node prisma/seed.mjs  (produzione)

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

// Deve restare allineato a passwordSchema in lib/validations/user.ts: quello
// schema, non questa costante, è la fonte di verità della policy. Un test
// (scripts/verify-seed-password-policy.test.ts) verifica l'allineamento.
const MIN_PASSWORD_LENGTH = 12;

// Stesso cost factor di lib/auth/password.ts: il login del primo admin deve
// avere lo stesso tempo di verifica di ogni altro utente.
const BCRYPT_COST = 12;

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "[seed] SEED_ADMIN_USERNAME e SEED_ADMIN_PASSWORD devono essere impostate nell'ambiente."
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[seed] SEED_ADMIN_PASSWORD deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`
    );
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[seed] DATABASE_URL non configurato nelle variabili d'ambiente.");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingAdminCount = await prisma.utente.count({
      where: { isAdmin: true },
    });

    if (existingAdminCount > 0) {
      console.log("[seed] un amministratore esiste già: nessuna azione.");
      return;
    }

    const passwordHash = await hash(password, BCRYPT_COST);

    await prisma.utente.create({
      data: {
        username,
        passwordHash,
        isAdmin: true,
        abilitato: true,
        // Password scelta da chi lancia lo script, non dall'amministratore
        // che la userà: stesso trattamento di createUser/resetUserPassword.
        mustChangePassword: true,
      },
    });

    console.log(
      `[seed] amministratore "${username}" creato. Ricorda di cambiare la password al primo accesso.`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed] errore imprevisto:", error);
  process.exitCode = 1;
});
