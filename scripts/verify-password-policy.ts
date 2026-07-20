import {
  passwordSchema,
  userCreateSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../lib/validations/user";
import { isCommonWeakPassword } from "../lib/auth/common-passwords";

// Regressione SEC-16: la policy password era solo "almeno 8 caratteri",
// senza deny-list di password comuni né verifica che la nuova password
// differisca da quella attuale in changePassword. Questo script verifica che
// la nuova policy (12 caratteri minimi, deny-list, newPassword !==
// currentPassword) sia realmente applicata.

const failures: string[] = [];

function assertRejects(result: { success: boolean }, message: string): void {
  if (result.success) {
    failures.push(`${message} — atteso il rifiuto, l'input è stato accettato`);
  }
}

function assertAccepts(result: { success: boolean }, message: string): void {
  if (!result.success) {
    failures.push(`${message} — atteso l'accettazione, l'input è stato rifiutato`);
  }
}

const STRONG_PASSWORD = "Xk9#mQ2!vLp8zR@w";

function testMinimumLength(): void {
  assertRejects(
    passwordSchema.safeParse("Short1!Aaaa"), // 11 caratteri, non comune
    "una password di 11 caratteri deve essere rifiutata (minimo 12)"
  );
  assertAccepts(
    passwordSchema.safeParse(STRONG_PASSWORD),
    "una password di 16 caratteri robusta e non comune deve essere accettata"
  );
}

function testCommonPasswordDenyList(): void {
  assertRejects(
    passwordSchema.safeParse("password123456"),
    "una password nella deny-list deve essere rifiutata"
  );
  assertRejects(
    passwordSchema.safeParse("PASSWORD123456"),
    "il controllo sulla deny-list deve ignorare maiuscole/minuscole"
  );
  if (!isCommonWeakPassword("password123456")) {
    failures.push("isCommonWeakPassword deve riconoscere le voci della deny-list");
  }
  if (isCommonWeakPassword(STRONG_PASSWORD)) {
    failures.push("isCommonWeakPassword non deve segnalare una password robusta come comune");
  }
}

function testUserCreateAndResetUseSamePolicy(): void {
  assertRejects(
    userCreateSchema.safeParse({
      username: "mario.rossi",
      isAdmin: false,
      abilitato: true,
      password: "short123456", // 11 caratteri, sotto la soglia minima di 12
    }),
    "userCreateSchema.password deve rifiutare una password di 11 caratteri"
  );
  assertAccepts(
    userCreateSchema.safeParse({
      username: "mario.rossi",
      isAdmin: false,
      abilitato: true,
      password: STRONG_PASSWORD,
    }),
    "userCreateSchema.password deve accettare una password robusta"
  );

  assertRejects(
    resetPasswordSchema.safeParse({ password: "welcome123456" }),
    "resetPasswordSchema.password deve rifiutare una password della deny-list"
  );
  assertAccepts(
    resetPasswordSchema.safeParse({ password: STRONG_PASSWORD }),
    "resetPasswordSchema.password deve accettare una password robusta"
  );
}

function testChangePasswordRejectsSameAsCurrent(): void {
  assertRejects(
    changePasswordSchema.safeParse({
      currentPassword: STRONG_PASSWORD,
      newPassword: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    }),
    "changePasswordSchema deve rifiutare newPassword identica a currentPassword"
  );

  const otherStrongPassword = "Qw7$tRz4!bNc2*Lm";
  assertAccepts(
    changePasswordSchema.safeParse({
      currentPassword: STRONG_PASSWORD,
      newPassword: otherStrongPassword,
      confirmPassword: otherStrongPassword,
    }),
    "changePasswordSchema deve accettare una newPassword robusta e diversa dalla attuale"
  );

  // Il controllo di conferma esistente deve continuare a funzionare insieme al nuovo.
  assertRejects(
    changePasswordSchema.safeParse({
      currentPassword: STRONG_PASSWORD,
      newPassword: otherStrongPassword,
      confirmPassword: "Qw7$tRz4!bNc2*Lz", // non coincide
    }),
    "changePasswordSchema deve continuare a rifiutare se newPassword e confirmPassword non coincidono"
  );
}

testMinimumLength();
testCommonPasswordDenyList();
testUserCreateAndResetUseSamePolicy();
testChangePasswordRejectsSameAsCurrent();

if (failures.length > 0) {
  console.error("verify-password-policy: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "Policy password: minimo 12 caratteri, deny-list password comuni e newPassword !== currentPassword applicati correttamente."
);
