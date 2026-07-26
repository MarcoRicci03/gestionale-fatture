import { describe, it, expect } from "vitest";
import { redactUsernameForAudit } from "./redact-username";

describe("redactUsernameForAudit", () => {
  it("non tronca una stringa di 3 caratteri o meno", () => {
    expect(redactUsernameForAudit("ab")).toBe("ab");
    expect(redactUsernameForAudit("abc")).toBe("abc");
  });

  it("non tronca una stringa vuota", () => {
    expect(redactUsernameForAudit("")).toBe("");
  });

  it("tronca a 3 caratteri con ellissi oltre la soglia", () => {
    expect(redactUsernameForAudit("mariorossi")).toBe("mar…");
  });

  it("non espone una password digitata per errore nel campo username", () => {
    const passwordDigitataPerErrore = "SuperSegreta123!";
    const redacted = redactUsernameForAudit(passwordDigitataPerErrore);
    expect(redacted).toBe("Sup…");
    expect(redacted).not.toContain("Segreta");
    expect(redacted.length).toBeLessThan(passwordDigitataPerErrore.length);
  });
});
