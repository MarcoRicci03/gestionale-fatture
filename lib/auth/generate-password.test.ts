import { describe, it, expect } from "vitest";
import { generateTemporaryPassword } from "./generate-password";
import { passwordSchema } from "@/lib/validations/user";

const FORMAT_REGEX = /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/;
const AMBIGUOUS_CHARS = ["0", "O", "1", "l", "I", "i"];

describe("generateTemporaryPassword", () => {
  it("supera sempre passwordSchema (200 generazioni)", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(passwordSchema.safeParse(password).success).toBe(true);
    }
  });

  it("rispetta il formato NNNN-NNNN-NNNN-NNNN", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTemporaryPassword()).toMatch(FORMAT_REGEX);
    }
  });

  it("non contiene caratteri ambigui", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      for (const char of AMBIGUOUS_CHARS) {
        expect(password).not.toContain(char);
      }
    }
  });

  it("produce valori distinti", () => {
    const generated = new Set(
      Array.from({ length: 200 }, () => generateTemporaryPassword())
    );
    expect(generated.size).toBe(200);
  });

  it("usa caratteri da tutte le classi dell'alfabeto (campione ampio)", () => {
    const all = Array.from({ length: 200 }, () =>
      generateTemporaryPassword()
    ).join("");
    expect(/[a-z]/.test(all)).toBe(true);
    expect(/[A-Z]/.test(all)).toBe(true);
    expect(/[2-9]/.test(all)).toBe(true);
  });
});
