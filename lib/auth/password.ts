import { hash, compare } from "bcryptjs";

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, 12);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(plainPassword, hashedPassword);
}
