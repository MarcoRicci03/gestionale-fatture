import { z } from "zod";

export const userCreateSchema = z.object({
  username: z
    .string()
    .min(3, "L'username deve avere almeno 3 caratteri")
    .max(50, "L'username deve avere al massimo 50 caratteri"),
  nome: z.string().optional(),
  cognome: z.string().optional(),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  isAdmin: z.boolean(),
  abilitato: z.boolean(),
});

export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(3, "L'username deve avere almeno 3 caratteri")
    .max(50, "L'username deve avere al massimo 50 caratteri"),
  nome: z.string().optional(),
  cognome: z.string().optional(),
  isAdmin: z.boolean(),
  abilitato: z.boolean(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale"),
    newPassword: z.string().min(8, "La nuova password deve avere almeno 8 caratteri"),
    confirmPassword: z.string().min(1, "Conferma la nuova password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

export type UserCreateFormData = z.output<typeof userCreateSchema>;
export type UserUpdateFormData = z.output<typeof userUpdateSchema>;
export type ResetPasswordFormData = z.output<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.output<typeof changePasswordSchema>;
