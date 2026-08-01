// Oggetto mutabile condiviso tra un test file e il proprio `vi.mock("@/lib/auth/session", ...)`:
// le Server Action richiedono `requireUserId()`, che a sua volta chiama
// `cookies()` di `next/headers` — un'API che esiste solo dentro una richiesta
// Next.js reale e lancia se chiamata da un test Vitest plain. Ogni test file
// che vuole esercitare una Server Action vera contro il database di test deve
// quindi mockare `requireUserId` per restituire l'id dell'Utente di test
// creato in `beforeAll`, impostato qui. Il resto (Prisma, transazioni,
// vincoli DB, business logic) resta reale: solo il confine con
// next/headers viene sostituito.
export const authContext = { userId: 0 };
