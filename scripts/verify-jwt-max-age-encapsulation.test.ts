// @vitest-environment node
import { it, expect, beforeAll } from "vitest";

// jose confronta il secret firmato con `instanceof Uint8Array`: sotto
// l'ambiente jsdom di default, TextEncoder produce un Uint8Array di un realm
// diverso da quello che jose usa internamente, e il confronto fallisce
// ("payload must be an instance of Uint8Array") pur essendo funzionalmente
// corretto. Questo modulo non tocca il DOM: gira in un ambiente Node puro,
// come faceva lo script originale sotto tsx.

// Regressione SEC-17: getTokenMaxAgeSeconds usa decodeJwt (non verificato,
// legge il payload senza controllare la firma). Prima era esportata e
// accettava un token qualsiasi come parametro: sicura solo perché l'unico
// chiamante esistente le passava sempre un token appena firmato da questo
// server, ma nulla nei tipi impediva a un futuro chiamante di passarle un
// token arbitrario letto da un client. Ora non è più esportata: l'unico modo
// di ottenere token+durata insieme è signSessionWithMaxAge, che li produce
// accoppiati e non accetta mai un token esterno.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts: import
// dinamico in beforeAll, dopo aver valorizzato process.env.JWT_SECRET, come
// negli altri test che toccano questo modulo.

beforeAll(() => {
  process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";
});

it("getTokenMaxAgeSeconds non è esportata dal modulo (deve restare privata)", async () => {
  const jwtModule = (await import("../lib/auth/jwt")) as Record<string, unknown>;
  expect(typeof jwtModule.getTokenMaxAgeSeconds).toBe("undefined");
  expect(typeof jwtModule.signSessionWithMaxAge).toBe("function");
});

it("signSessionWithMaxAge calcola una durata coerente col token", async () => {
  const { signSessionWithMaxAge } = await import("../lib/auth/jwt");
  const { decodeJwt } = await import("jose");

  const { token, maxAgeSeconds } = await signSessionWithMaxAge(42, 0);

  const { exp, iat } = decodeJwt(token);
  expect(typeof exp).toBe("number");
  expect(typeof iat).toBe("number");

  expect(maxAgeSeconds).toBe((exp as number) - (iat as number));

  // Default JWT_EXPIRES_IN non impostato in questo test => fallback "7d" in signSession.
  const sevenDaysInSeconds = 7 * 24 * 60 * 60;
  expect(maxAgeSeconds).toBe(sevenDaysInSeconds);
});
