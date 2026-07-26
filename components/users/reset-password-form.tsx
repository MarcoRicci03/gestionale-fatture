"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { TemporaryPasswordField } from "@/components/users/temporary-password-field";
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
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  const password = useWatch({ control, name: "password" });

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
      <TemporaryPasswordField
        label="Nuova password"
        value={password ?? ""}
        onValueChange={(value) =>
          setValue("password", value, { shouldValidate: true })
        }
        error={errors.password?.message}
      />

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
