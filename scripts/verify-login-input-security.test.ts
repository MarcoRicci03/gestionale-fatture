import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// SEC-10: Verifica statica e comportamentale delle invarianti di sicurezza
// per input sovradimensionati o fuori limite nel flusso di login:
// 1. checkLoginRateLimit DEVE precedere la validazione delle dimensioni di username e password,
//    in modo che attacchi di flooding con payload giganti non bypassino il rate limiter.
// 2. Il superamento dei limiti dimensionali DEVE consumare un tentativo tramite recordFailedLogin.
// 3. Il superamento dei limiti dimensionali DEVE eseguire verifyPassword(..., DUMMY_HASH)
//    per mantenere il tempo di risposta uniforme ed evitare timing oracle.
// 4. L'errore restituito DEVE essere il messaggio generico "Credenziali non valide"
//    senza rivelare il fallimento di lunghezza ("Input non valido").

const AUTH_ACTION_PATH = join(__dirname, "..", "lib", "actions", "auth.ts");

describe("SEC-10: Login input security & timing invariant", () => {
  const source = readFileSync(AUTH_ACTION_PATH, "utf-8");

  it("checkLoginRateLimit precede la validazione dimensionale di username/password", () => {
    const rateLimitIndex = source.indexOf("checkLoginRateLimit(");
    const sizeCheckIndex = source.indexOf("Buffer.byteLength(password");

    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(sizeCheckIndex).toBeGreaterThan(-1);
    expect(
      rateLimitIndex,
      "checkLoginRateLimit deve essere chiamato PRIMA del controllo sulla dimensione dell'input"
    ).toBeLessThan(sizeCheckIndex);
  });

  it("il controllo dimensionale registra il fallimento nel rate limiter", () => {
    const sizeCheckBlock = source.slice(
      source.indexOf("Buffer.byteLength(password"),
      source.indexOf("prisma.utente.findUnique")
    );

    expect(sizeCheckBlock).toContain("recordFailedLogin(");
  });

  it("il controllo dimensionale esegue verifyPassword con DUMMY_HASH", () => {
    const sizeCheckBlock = source.slice(
      source.indexOf("Buffer.byteLength(password"),
      source.indexOf("prisma.utente.findUnique")
    );

    expect(sizeCheckBlock).toContain("verifyPassword(");
    expect(sizeCheckBlock).toContain("DUMMY_HASH");
  });

  it("il controllo dimensionale restituisce 'Credenziali non valide' e non 'Input non valido'", () => {
    const sizeCheckBlock = source.slice(
      source.indexOf("Buffer.byteLength(password"),
      source.indexOf("prisma.utente.findUnique")
    );

    expect(sizeCheckBlock).toContain('error: "Credenziali non valide"');
    expect(sizeCheckBlock).not.toContain('error: "Input non valido"');
  });

  it("la chiave del rate limiter viene troncata a massimo 50 caratteri", () => {
    expect(source).toContain("username.slice(0, 50)");
  });
});
