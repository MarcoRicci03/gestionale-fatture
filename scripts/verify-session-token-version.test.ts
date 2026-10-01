// @vitest-environment node
import { it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

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

it("toggleUserEnabled incrementa tokenVersion quando l'account viene disabilitato (SEC-08)", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "actions", "users.ts"), "utf-8");
  const toggleFn = source.slice(source.indexOf("export async function toggleUserEnabled"));
  expect(toggleFn).toMatch(/!abilitato\s*\?\s*\{\s*tokenVersion:\s*\{\s*increment:\s*1\s*\}\s*\}\s*:\s*\{\}/);
});

it("updateUser incrementa tokenVersion in caso di disabilitazione, revoca admin o cambio username (SEC-08)", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "actions", "users.ts"), "utf-8");
  const updateFn = source.slice(
    source.indexOf("export async function updateUser"),
    source.indexOf("export async function resetUserPassword")
  );
  expect(updateFn).toMatch(/!abilitato/);
  expect(updateFn).toMatch(/current\.isAdmin\s*&&\s*!isAdmin/);
  expect(updateFn).toMatch(/current\.username\s*!==\s*username/);
  expect(updateFn).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
});

it("logout incrementa tokenVersion in database per revoca lato server (SEC-08)", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "actions", "auth.ts"), "utf-8");
  const logoutFn = source.slice(source.indexOf("export async function logout"));
  expect(logoutFn).toMatch(/prisma\.utente\.update/);
  expect(logoutFn).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
});


