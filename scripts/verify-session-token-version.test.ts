// @vitest-environment node
import { it, expect, beforeAll } from "vitest";

// jose confronta il secret firmato con `instanceof Uint8Array`: sotto
// l'ambiente jsdom di default, TextEncoder produce un Uint8Array di un realm
// diverso da quello che jose usa internamente, e il confronto fallisce
// ("payload must be an instance of Uint8Array") pur essendo funzionalmente
// corretto. Questo modulo non tocca il DOM: gira in un ambiente Node puro,
// come faceva lo script originale sotto tsx.
//
// Un JWT di sessione deve portare il tokenVersion con cui
// è stato firmato, così getSession() (lib/auth/session.ts) può confrontarlo
// con Utente.tokenVersion e invalidare i token emessi prima di un cambio o
// reset password, anche se non ancora scaduti.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts (che legge la
// variabile al caricamento del modulo e fallisce se assente): per questo
// l'import è dinamico in beforeAll, dopo aver valorizzato
// process.env.JWT_SECRET se il processo gira senza un .env caricato.

beforeAll(() => {
  process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";
});

it("il payload porta lo stesso tokenVersion con cui il token è stato firmato", async () => {
  const { signSession, verifySession } = await import("../lib/auth/jwt");

  const token = await signSession(42, 3);
  const payload = await verifySession(token);

  expect(payload?.sub).toBe("42");
  expect(payload?.tokenVersion).toBe(3);
});

it("un tokenVersion superato rispetto al valore corrente in DB è rilevabile", async () => {
  const { signSession, verifySession } = await import("../lib/auth/jwt");

  // Simula un token firmato PRIMA di un cambio password (tokenVersion 3),
  // mentre in DB Utente.tokenVersion è ormai 4: è esattamente il confronto
  // che getSession() fa tra payload.tokenVersion e user.tokenVersion.
  const staleToken = await signSession(42, 3);
  const payload = await verifySession(staleToken);
  const currentDbTokenVersion = 4;

  expect(payload !== null && payload.tokenVersion === currentDbTokenVersion).toBe(false);
});

it("un token senza claim tokenVersion viene rifiutato", async () => {
  const { verifySession } = await import("../lib/auth/jwt");
  const { SignJWT } = await import("jose");

  // Un token senza claim tokenVersion (es. emesso da codice precedente a
  // questo fix) deve essere rifiutato esplicitamente, non trattato come
  // valido con tokenVersion undefined.
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const legacyToken = await new SignJWT({ sub: "42" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const payload = await verifySession(legacyToken);
  expect(payload).toBeNull();
});
