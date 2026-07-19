"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateFormData,
  type UserUpdateFormData,
} from "@/lib/validations/user";
import { createUser, updateUser } from "@/lib/actions/users";
import type { Utente } from "@prisma/client";

type UserFormProps = {
  user?: Utente;
  onSuccess?: () => void;
};

function UserCreateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      username: "",
      nome: "",
      cognome: "",
      password: "",
      isAdmin: false,
      abilitato: true,
    } satisfies UserCreateFormData,
  });

  const onSubmit = (data: UserCreateFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createUser(data);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <UserFields register={register} errors={errors} showPassword />
      <SubmitButton isPending={isPending} serverError={serverError} label="Crea utente" />
    </form>
  );
}

function UserEditForm({
  user,
  onSuccess,
}: {
  user: Utente;
  onSuccess?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      username: user.username,
      nome: user.nome ?? "",
      cognome: user.cognome ?? "",
      isAdmin: user.isAdmin,
      abilitato: user.abilitato,
    },
  });

  const onSubmit = (data: UserUpdateFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateUser(user.id, data);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <UserFields register={register} errors={errors} />
      <SubmitButton isPending={isPending} serverError={serverError} label="Aggiorna" />
    </form>
  );
}

type FieldProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  showPassword?: boolean;
};

function UserFields({ register, errors, showPassword }: FieldProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" {...register("username")} />
        {errors.username && (
          <p className="text-sm text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" {...register("nome")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cognome">Cognome</Label>
          <Input id="cognome" {...register("cognome")} />
        </div>
      </div>

      {showPassword && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input id="isAdmin" type="checkbox" {...register("isAdmin")} />
        <Label htmlFor="isAdmin">Amministratore</Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="abilitato" type="checkbox" {...register("abilitato")} />
        <Label htmlFor="abilitato">Account abilitato</Label>
      </div>
    </>
  );
}

function SubmitButton({
  isPending,
  serverError,
  label,
}: {
  isPending: boolean;
  serverError: string | null;
  label: string;
}) {
  return (
    <>
      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvataggio..." : label}
      </Button>
    </>
  );
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  if (user) {
    return <UserEditForm user={user} onSuccess={onSuccess} />;
  }
  return <UserCreateForm onSuccess={onSuccess} />;
}
