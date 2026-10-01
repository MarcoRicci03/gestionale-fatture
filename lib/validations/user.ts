import { z } from "zod";
import { isCommonWeakPassword } from "@/lib/auth/common-passwords";

const userCommonSchema = {
  username: z
    .string()
    .min(3, "L'username deve avere almeno 3 caratteri")
    .max(50, "L'username deve avere al massimo 50 caratteri"),
  nome: z.string().max(100).optional(),
  cognome: z.string().max(100).optional(),
  isAdmin: z.boolean(),
  abilitato: z.boolean(),
} as const;

export const MAX_PASSWORD_BYTES = 72;

// Condiviso da userCreateSchema, resetPasswordSchema e changePasswordSchema:
// 12 caratteri minimi (non 8), massimo 72 caratteri e 72 byte (limite standard bcrypt),
// e rifiuto di una deny-list di password comuni note (vedi lib/auth/common-passwords.ts).
export const passwordSchema = z
  .string()
  .min(12, "La password deve avere almeno 12 caratteri")
  .max(72, "La password non può superare 72 caratteri")
  .refine((val) => Buffer.byteLength(val, "utf8") <= MAX_PASSWORD_BYTES, {
    message: "La password non può superare 72 byte",
  })
  .refine((value) => !isCommonWeakPassword(value), {
    message: "Questa password è troppo comune, scegline una più sicura",
  });

export const userCreateSchema = z.object({
  ...userCommonSchema,
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  ...userCommonSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Inserisci la password attuale")
      .max(100, "La password attuale non può superare 100 caratteri"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Conferma la nuova password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "La nuova password deve essere diversa da quella attuale",
    path: ["newPassword"],
  });

export type UserCreateFormData = z.output<typeof userCreateSchema>;
export type UserUpdateFormData = z.output<typeof userUpdateSchema>;
export type ResetPasswordFormData = z.output<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.output<typeof changePasswordSchema>;
