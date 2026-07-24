import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  userCreateSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../lib/validations/user";
import { isCommonWeakPassword } from "../lib/auth/common-passwords";

// La policy password era solo "almeno 8 caratteri",
// senza deny-list di password comuni né verifica che la nuova password
// differisca da quella attuale in changePassword. Questo test verifica che la
// nuova policy (12 caratteri minimi, deny-list, newPassword !==
// currentPassword) sia realmente applicata.

const STRONG_PASSWORD = "Xk9#mQ2!vLp8zR@w";

describe("passwordSchema", () => {
  it("rifiuta una password di 11 caratteri (minimo 12)", () => {
    expect(passwordSchema.safeParse("Short1!Aaaa").success).toBe(false); // 11 caratteri, non comune
  });
  it("accetta una password di 16 caratteri robusta e non comune", () => {
    expect(passwordSchema.safeParse(STRONG_PASSWORD).success).toBe(true);
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
});
