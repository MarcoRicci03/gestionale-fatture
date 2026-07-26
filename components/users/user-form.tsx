"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemporaryPasswordField } from "@/components/users/temporary-password-field";
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateFormData,
  type UserUpdateFormData,
} from "@/lib/validations/user";
import { createUser, updateUser } from "@/lib/actions/users";
import type { SafeUtente } from "@/lib/data/user-select";

type UserFormProps = {
  user?: SafeUtente;
  onSuccess?: () => void;
};

function UserCreateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  const password = useWatch({ control, name: "password" });

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

      <TemporaryPasswordField
        value={password ?? ""}
        onValueChange={(value) =>
          setValue("password", value, { shouldValidate: true })
        }
        error={errors.password?.message}
        autoGenerate
      />

      <div className="flex items-center gap-2">
        <input id="isAdmin" type="checkbox" {...register("isAdmin")} />
        <Label htmlFor="isAdmin">Amministratore</Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="abilitato" type="checkbox" {...register("abilitato")} />
        <Label htmlFor="abilitato">Account abilitato</Label>
      </div>

      <SubmitButton isPending={isPending} serverError={serverError} label="Crea utente" />
    </form>
  );
}

function UserEditForm({
  user,
  onSuccess,
}: {
  user: SafeUtente;
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

      <div className="flex items-center gap-2">
        <input id="isAdmin" type="checkbox" {...register("isAdmin")} />
        <Label htmlFor="isAdmin">Amministratore</Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="abilitato" type="checkbox" {...register("abilitato")} />
        <Label htmlFor="abilitato">Account abilitato</Label>
      </div>

      <SubmitButton isPending={isPending} serverError={serverError} label="Aggiorna" />
    </form>
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
