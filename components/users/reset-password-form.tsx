"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordFormData } from "@/lib/validations/user";
import { resetUserPassword } from "@/lib/actions/users";

type ResetPasswordFormProps = {
  userId: number;
  onSuccess?: () => void;
};

export function ResetPasswordForm({ userId, onSuccess }: ResetPasswordFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = await resetUserPassword(userId, data);
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
        <Label htmlFor="password">Nuova password</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Reset in corso..." : "Reset password"}
      </Button>
    </form>
  );
}
