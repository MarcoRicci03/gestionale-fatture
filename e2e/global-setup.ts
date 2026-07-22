import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Playwright esegue globalSetup come script standalone, non attraverso Next.js:
// senza questo, process.env.DATABASE_URL non sarebbe valorizzato e
// lib/prisma.ts lancerebbe subito un errore all'import. loadEnvConfig è lo
// stesso meccanismo con cui Next.js carica .env per `next dev`/`next build`.
loadEnvConfig(path.resolve(__dirname, ".."));

export default async function globalSetup() {
  const { prisma } = await import("@/lib/prisma");
  const { hashPassword } = await import("@/lib/auth/password");
  const { TEST_USER } = await import("./fixtures/test-user");

  const passwordHash = await hashPassword(TEST_USER.password);
  await prisma.utente.upsert({
    where: { username: TEST_USER.username },
    update: { passwordHash, abilitato: true },
    create: { username: TEST_USER.username, passwordHash },
  });
  await prisma.$disconnect();
}
