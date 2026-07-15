"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "@/lib/validations/user";
import { changePassword } from "@/lib/actions/account";

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    setServerError(null);
    setServerSuccess(null);
    startTransition(async () => {
      const result = await changePassword(data);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setServerSuccess("Password aggiornata con successo");
      reset();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-md space-y-4 rounded-lg border p-4"
    >
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Password attuale</Label>
        <Input
          id="currentPassword"
          type="password"
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p className="text-sm text-destructive">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nuova password</Label>
        <Input id="newPassword" type="password" {...register("newPassword")} />
        {errors.newPassword && (
          <p className="text-sm text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Conferma nuova password</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}
      {serverSuccess && (
        <p className="text-sm text-green-600" role="status">
          {serverSuccess}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Aggiornamento..." : "Cambia password"}
      </Button>
    </form>
  );
}
