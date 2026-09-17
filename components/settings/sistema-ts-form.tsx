"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  sistemaTsSettingsSchema,
  type SistemaTsSettingsInput,
  type SistemaTsSettingsData,
} from "@/lib/validations/sistema-ts";
import { saveSistemaTsSettings } from "@/lib/actions/sistema-ts";

type SistemaTsFormProps = {
  settings: {
    id: number;
    username: string;
    hasPassword: boolean;
    hasPincode: boolean;
    codiceRegione: string;
    codiceAsl: string;
    codiceStruttura: string;
    naturaIvaDefault: string;
  } | null;
  userCf?: string | null;
  userPiva?: string | null;
};

export function SistemaTsForm({ settings, userCf, userPiva }: SistemaTsFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPincode, setShowPincode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SistemaTsSettingsInput, unknown, SistemaTsSettingsData>({
    resolver: zodResolver(sistemaTsSettingsSchema),
    defaultValues: {
      username: settings?.username ?? userCf ?? "",
      password: "",
      pincode: "",
      codiceRegione: settings?.codiceRegione ?? "000",
      codiceAsl: settings?.codiceAsl ?? "000",
      codiceStruttura: settings?.codiceStruttura ?? "",
      naturaIvaDefault: (settings?.naturaIvaDefault as "N2.2" | "N4") ?? "N2.2",
    },
  });

  const onSubmit = (data: SistemaTsSettingsData) => {
    setServerError(null);
    setServerSuccess(null);
    startTransition(async () => {
      const result = await saveSistemaTsSettings(data);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setServerSuccess("Impostazioni Sistema TS salvate con successo.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {(!userCf || !userPiva) && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>
            Attenzione: il tuo profilo non contiene il Codice Fiscale o la Partita IVA.
            Per poter trasmettere a Sistema TS, assicurati di aver completato i dati
            nella pagina <strong>Account</strong>.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Credenziali di Accesso MEF / Sistema TS</CardTitle>
          </div>
          <CardDescription>
            Inserisci i parametri di autenticazione assegnati dal Ministero dell&apos;Economia
            e delle Finanze per il servizio di invio spese 730 precompilato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <strong>Sicurezza a riposo:</strong> Password e PinCode vengono cifrati simmetricamente
              nel database con algoritmo <strong>AES-256-GCM</strong> e decifrati esclusivamente in memoria
              durante la trasmissione a Sogei.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username / Codice Fiscale TS</Label>
              <Input
                id="username"
                {...register("username")}
                placeholder="es. RSSMRA80A01H501Z"
                aria-invalid={!!errors.username}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="naturaIvaDefault">Natura IVA Predefinita</Label>
              <select
                id="naturaIvaDefault"
                {...register("naturaIvaDefault")}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="N2.2">N2.2 - Regime Forfettario</option>
                <option value="N4">N4 - Regime Ordinario (Esente art. 10 DPR 633/72)</option>
              </select>
              {errors.naturaIvaDefault && (
                <p className="text-sm text-destructive">{errors.naturaIvaDefault.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password TS {settings?.hasPassword && <span className="text-xs text-muted-foreground font-normal">(già salvata)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("password")}
                  placeholder={
                    settings?.hasPassword
                      ? "•••••••• (lascia vuoto per mantenere attuale)"
                      : "Inserisci la password Sistema TS"
                  }
                  className="pr-10"
                  aria-invalid={!!errors.password}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode">
                PinCode TS {settings?.hasPincode && <span className="text-xs text-muted-foreground font-normal">(già salvato)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="pincode"
                  type={showPincode ? "text" : "password"}
                  autoComplete="off"
                  {...register("pincode")}
                  placeholder={
                    settings?.hasPincode
                      ? "•••••••• (lascia vuoto per mantenere attuale)"
                      : "Inserisci il PinCode TS (es. 8 cifre)"
                  }
                  className="pr-10"
                  aria-invalid={!!errors.pincode}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPincode((prev) => !prev)}
                  aria-label={showPincode ? "Nascondi pincode" : "Mostra pincode"}
                >
                  {showPincode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.pincode && (
                <p className="text-sm text-destructive">{errors.pincode.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Codici Struttura e Territorialità</CardTitle>
          <CardDescription>
            Parametri opzionali o specifici per la categoria di appartenenza (Regione, ASL, Struttura).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="codiceRegione">Codice Regione</Label>
            <Input
              id="codiceRegione"
              maxLength={3}
              {...register("codiceRegione")}
              placeholder="000"
              aria-invalid={!!errors.codiceRegione}
            />
            <p className="text-xs text-muted-foreground">Default &quot;000&quot; per professionisti</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="codiceAsl">Codice ASL</Label>
            <Input
              id="codiceAsl"
              maxLength={3}
              {...register("codiceAsl")}
              placeholder="000"
              aria-invalid={!!errors.codiceAsl}
            />
            <p className="text-xs text-muted-foreground">Default &quot;000&quot; per professionisti</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="codiceStruttura">Codice Struttura (SSA)</Label>
            <Input
              id="codiceStruttura"
              {...register("codiceStruttura")}
              placeholder="Lascia vuoto se non applicabile"
              aria-invalid={!!errors.codiceStruttura}
            />
            <p className="text-xs text-muted-foreground">Solo se operi all&apos;interno di struttura autorizzata</p>
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {serverSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{serverSuccess}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvataggio in corso..." : "Salva Impostazioni"}
        </Button>
      </div>
    </form>
  );
}
