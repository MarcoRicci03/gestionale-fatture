import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  passwordSchema,
  userCreateSchema,
  resetPasswordSchema,
  changePasswordSchema,
  MAX_PASSWORD_BYTES,
} from "../lib/validations/user";
import { isCommonWeakPassword } from "../lib/auth/common-passwords";
import { hashPassword } from "../lib/auth/password";

// La policy password:
// - 12 caratteri minimi
// - massimo 72 caratteri e 72 byte (limite architetturale bcrypt)
// - deny-list di password comuni note
// - verifica che la nuova password differisca da quella attuale in changePassword.

const STRONG_PASSWORD = "Xk9#mQ2!vLp8zR@w";

describe("passwordSchema", () => {
  it("rifiuta una password di 11 caratteri (minimo 12)", () => {
    expect(passwordSchema.safeParse("Short1!Aaaa").success).toBe(false); // 11 caratteri, non comune
  });
  it("accetta una password di 16 caratteri robusta e non comune", () => {
    expect(passwordSchema.safeParse(STRONG_PASSWORD).success).toBe(true);
  });

  it("rifiuta una password superiore a 72 caratteri", () => {
    expect(passwordSchema.safeParse("A".repeat(73)).success).toBe(false);
  });

  it("rifiuta una password con <= 72 caratteri ma superiore a 72 byte UTF-8", () => {
    const euroPassword = "€".repeat(25); // 25 caratteri × 3 byte = 75 byte
    const res = passwordSchema.safeParse(euroPassword);
    expect(res.success).toBe(false);
    expect(
      res.error?.issues.some((i) => i.message === "La password non può superare 72 byte")
    ).toBe(true);
  });

  it("accetta una password robusta al limite esatto di 72 caratteri e 72 byte", () => {
    const exact72 = STRONG_PASSWORD + "a".repeat(72 - STRONG_PASSWORD.length);
    expect(Buffer.byteLength(exact72, "utf8")).toBe(72);
    expect(passwordSchema.safeParse(exact72).success).toBe(true);
  });

  it("rifiuta una password nella deny-list", () => {
    expect(passwordSchema.safeParse("password123456").success).toBe(false);
  });
  it("la deny-list ignora maiuscole/minuscole", () => {
    expect(passwordSchema.safeParse("PASSWORD123456").success).toBe(false);
  });
});

describe("isCommonWeakPassword", () => {
  it("riconosce le voci della deny-list", () => {
    expect(isCommonWeakPassword("password123456")).toBe(true);
  });
  it("non segnala una password robusta come comune", () => {
    expect(isCommonWeakPassword(STRONG_PASSWORD)).toBe(false);
  });
});

describe("userCreateSchema/resetPasswordSchema usano la stessa policy", () => {
  it("userCreateSchema.password rifiuta una password di 11 caratteri", () => {
    expect(
      userCreateSchema.safeParse({
        username: "mario.rossi",
        isAdmin: false,
        abilitato: true,
        password: "short123456", // 11 caratteri, sotto la soglia minima di 12
      }).success
    ).toBe(false);
  });
  it("userCreateSchema.password accetta una password robusta", () => {
    expect(
      userCreateSchema.safeParse({
        username: "mario.rossi",
        isAdmin: false,
        abilitato: true,
        password: STRONG_PASSWORD,
      }).success
    ).toBe(true);
  });

  it("resetPasswordSchema.password rifiuta una password della deny-list", () => {
    expect(resetPasswordSchema.safeParse({ password: "welcome123456" }).success).toBe(false);
  });
  it("resetPasswordSchema.password accetta una password robusta", () => {
    expect(resetPasswordSchema.safeParse({ password: STRONG_PASSWORD }).success).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("rifiuta newPassword identica a currentPassword", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: STRONG_PASSWORD,
        newPassword: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }).success
    ).toBe(false);
  });

  const otherStrongPassword = "Qw7$tRz4!bNc2*Lm";

  it("accetta una newPassword robusta e diversa dalla attuale", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: STRONG_PASSWORD,
        newPassword: otherStrongPassword,
        confirmPassword: otherStrongPassword,
      }).success
    ).toBe(true);
  });

  it("continua a rifiutare se newPassword e confirmPassword non coincidono", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: STRONG_PASSWORD,
        newPassword: otherStrongPassword,
        confirmPassword: "Qw7$tRz4!bNc2*Lz", // non coincide
      }).success
    ).toBe(false);
  });

  it("rifiuta currentPassword se supera 100 caratteri", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "A".repeat(101),
        newPassword: otherStrongPassword,
        confirmPassword: otherStrongPassword,
      }).success
    ).toBe(false);
  });
});

describe("hashPassword fail-fast 72 byte limit", () => {
  it("consente l'hashing di password lecite entro i 72 byte", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);
    expect(hash).toBeDefined();
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("lancia eccezione se la password supera i 72 caratteri ASCII", async () => {
    await expect(hashPassword("A".repeat(73))).rejects.toThrow(
      "La password supera il limite massimo di 72 byte supportato da bcrypt"
    );
  });

  it("lancia eccezione se la password supera i 72 byte con caratteri multibyte UTF-8", async () => {
    await expect(hashPassword("€".repeat(25))).rejects.toThrow(
      "La password supera il limite massimo di 72 byte supportato da bcrypt"
    );
  });
});

describe("login input guard alignment in lib/actions/auth.ts", () => {
  it("il server action login() applica il vincolo massimo di 72 byte alla password", () => {
    const authSource = readFileSync(
      join(__dirname, "..", "lib", "actions", "auth.ts"),
      "utf-8"
    );
    expect(authSource).toMatch(/password\.length\s*>\s*72/);
    expect(authSource).toMatch(
      /Buffer\.byteLength\(\s*password,\s*["']utf8["']\s*\)\s*>\s*72/
    );
  });
});
