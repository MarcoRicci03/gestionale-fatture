"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  profileUpdateSchema,
  type ProfileUpdateFormData,
} from "@/lib/validations/profile";
import { updateProfile } from "@/lib/actions/account";
import type { Utente } from "@prisma/client";

type ProfileFormProps = {
  user: Utente;
};

export function ProfileForm({ user }: ProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      nome: user.nome ?? "",
      cognome: user.cognome ?? "",
      pIva: user.pIva ?? "",
      cf: user.cf ?? "",
      via: user.via ?? "",
      citta: user.citta ?? "",
      cap: user.cap ?? "",
      provincia: user.provincia ?? "",
      titolo: user.titolo ?? "",
      specializzazione: user.specializzazione ?? "",
    },
  });

  const onSubmit = (data: ProfileUpdateFormData) => {
    setServerError(null);
    setServerSuccess(null);
    startTransition(async () => {
      const result = await updateProfile(data);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setServerSuccess("Profilo aggiornato con successo");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="titolo">Titolo</Label>
          <Input
            id="titolo"
            placeholder="es. Dott.ssa"
            {...register("titolo")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specializzazione">Specializzazione</Label>
          <Input
            id="specializzazione"
            placeholder="es. Logopedista"
            {...register("specializzazione")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pIva">P.IVA</Label>
          <Input id="pIva" placeholder="11 cifre" {...register("pIva")} />
          {errors.pIva && (
            <p className="text-sm text-destructive">{errors.pIva.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf">Codice fiscale</Label>
          <Input id="cf" placeholder="16 caratteri" {...register("cf")} />
          {errors.cf && (
            <p className="text-sm text-destructive">{errors.cf.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="via">Via / Indirizzo</Label>
        <Input id="via" {...register("via")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="citta">Città</Label>
          <Input id="citta" {...register("citta")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cap">CAP</Label>
          <Input id="cap" {...register("cap")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provincia">Provincia (sigla)</Label>
          <Input
            id="provincia"
            placeholder="es. MI"
            {...register("provincia")}
          />
          {errors.provincia && (
            <p className="text-sm text-destructive">
              {errors.provincia.message}
            </p>
          )}
        </div>
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
        {isPending ? "Salvataggio..." : "Salva profilo"}
      </Button>
    </form>
  );
}
