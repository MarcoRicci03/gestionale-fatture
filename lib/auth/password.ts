import { hash, compare } from "bcryptjs";

export async function hashPassword(plainPassword: string): Promise<string> {
  if (Buffer.byteLength(plainPassword, "utf8") > 72) {
    throw new Error("La password supera il limite massimo di 72 byte supportato da bcrypt");
  }
  return hash(plainPassword, 12);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(plainPassword, hashedPassword);
}
