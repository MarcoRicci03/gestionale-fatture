"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  patientSchema,
  type PatientFormInput,
  type PatientFormData,
} from "@/lib/validations/patient";
import { createPatient, updatePatient } from "@/lib/actions/patients";
import { cn } from "@/lib/utils";
import type { Paziente, Pagante } from "@prisma/client";

type PatientFormProps = {
  patient?: Paziente & { pagante?: Pagante | null };
  payers: Pagante[];
  onSuccess?: () => void;
};

export function PatientForm({ patient, payers, onSuccess }: PatientFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormInput, unknown, PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      nome: patient?.nome ?? "",
      cognome: patient?.cognome ?? "",
      id_Pagante: patient?.id_Pagante ?? "",
    },
  });

  const onSubmit = (data: PatientFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = patient
        ? await updatePatient(patient.id, data)
        : await createPatient(data);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/patients");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" {...register("nome")} aria-invalid={!!errors.nome} />
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
          <p className="text-sm text-destructive">{errors.cognome.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="id_Pagante">Pagante</Label>
        <select
          id="id_Pagante"
          {...register("id_Pagante")}
          className={cn(
            "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            errors.id_Pagante && "border-destructive"
          )}
        >
          <option value="">Nessun pagante</option>
          {payers.map((payer) => (
            <option key={payer.id} value={payer.id}>
              {payer.cognome} {payer.nome}
            </option>
          ))}
        </select>
        {errors.id_Pagante && (
          <p className="text-sm text-destructive">
            {errors.id_Pagante.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvataggio..." : patient ? "Aggiorna" : "Crea paziente"}
      </Button>
    </form>
  );
}
