// Deny-list non esaustiva di password comuni note, usata come ulteriore
// livello di difesa oltre al requisito di lunghezza minima. Le voci sono
// già lunghe almeno 12 caratteri: più corte
// sarebbero comunque respinte dal requisito di lunghezza minima in
// lib/validations/user.ts, quindi non serve includerle qui.
const COMMON_WEAK_PASSWORDS = new Set(
  [
    "password123456",
    "password1234",
    "password12345",
    "passw0rd123456",
    "123456789012",
    "1234567890123",
    "12345678901234",
    "qwertyuiop123",
    "qwertyuiop1234",
    "letmein123456",
    "welcome123456",
    "changeme12345",
    "iloveyou12345",
    "admin12345678",
    "administrator",
    "trustno112345",
    "monkey1234567",
    "dragon1234567",
    "football12345",
    "superman12345",
    "princess12345",
    "sunshine12345",
    "abcdefghijkl",
    "aaaaaaaaaaaa1",
  ].map((p) => p.toLowerCase())
);

export function isCommonWeakPassword(password: string): boolean {
  return COMMON_WEAK_PASSWORDS.has(password.toLowerCase());
}
