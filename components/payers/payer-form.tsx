"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  payerSchema,
  type PayerFormInput,
  type PayerFormData,
} from "@/lib/validations/payer";
import { createPayer, updatePayer } from "@/lib/actions/payers";
import type { Pagante } from "@prisma/client";

type PayerFormProps = {
  payer?: Pagante;
  onSuccess?: () => void;
};

export function PayerForm({ payer, onSuccess }: PayerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PayerFormInput, unknown, PayerFormData>({
    resolver: zodResolver(payerSchema),
    defaultValues: {
      nome: payer?.nome ?? "",
      cognome: payer?.cognome ?? "",
      via: payer?.via ?? "",
      citta: payer?.citta ?? "",
      cap: payer?.cap ?? "",
      cf: payer?.cf ?? "",
      piva: payer?.piva ?? "",
    },
  });

  const onSubmit = (data: PayerFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = payer
        ? await updatePayer(payer.id, data)
        : await createPayer(data);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/payers");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            {...register("nome")}
            aria-invalid={!!errors.nome}
          />
          {errors.nome && (
            <p className="text-sm text-destructive">{errors.nome.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cognome">Cognome</Label>
          <Input
            id="cognome"
            {...register("cognome")}
            aria-invalid={!!errors.cognome}
          />
          {errors.cognome && (
            <p className="text-sm text-destructive">
              {errors.cognome.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="via">Via</Label>
        <Input id="via" {...register("via")} aria-invalid={!!errors.via} />
        {errors.via && (
          <p className="text-sm text-destructive">{errors.via.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="citta">Città</Label>
          <Input
            id="citta"
            {...register("citta")}
            aria-invalid={!!errors.citta}
          />
          {errors.citta && (
            <p className="text-sm text-destructive">{errors.citta.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cap">CAP</Label>
          <Input id="cap" {...register("cap")} aria-invalid={!!errors.cap} />
          {errors.cap && (
            <p className="text-sm text-destructive">{errors.cap.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cf">Codice Fiscale</Label>
          <Input id="cf" {...register("cf")} aria-invalid={!!errors.cf} />
          {errors.cf && (
            <p className="text-sm text-destructive">{errors.cf.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="piva">Partita IVA</Label>
          <Input
            id="piva"
            {...register("piva")}
            aria-invalid={!!errors.piva}
          />
          {errors.piva && (
            <p className="text-sm text-destructive">{errors.piva.message}</p>
          )}
        </div>
      </div>

      {errors.root && (
        <p className="text-sm text-destructive" role="alert">
          {errors.root.message}
        </p>
      )}

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvataggio..." : payer ? "Aggiorna" : "Crea pagante"}
      </Button>
    </form>
  );
}
