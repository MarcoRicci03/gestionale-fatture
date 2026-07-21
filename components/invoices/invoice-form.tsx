"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  invoiceSchema,
  type InvoiceFormInput,
  type InvoiceFormData,
} from "@/lib/validations/invoice";
import {
  createInvoice,
  updateInvoice,
  getNextInvoiceNumberForYear,
} from "@/lib/actions/invoices";
import { MESI, type Mese } from "@/lib/constants/mesi";
import { SOGLIA_BOLLO, IMPORTO_BOLLO } from "@/lib/constants/bollo";
import { formatDateInput, parseDateInput } from "@/lib/utils/date";
import { roundCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { FatturaMese, Pagante, Paziente, $Enums } from "@prisma/client";

type InvoiceWithRelations = {
  id: number;
  id_Utente: number;
  id_Pagante: number;
  id_Paziente: number;
  prezzo_totale: number;
  mod_pag: $Enums.ModalitaPagamento;
  sedute: number | null;
  commento: string | null;
  n_fattura: number;
  data: Date;
  citta: string;
  cap: string;
  pdfLayoutSnapshot: unknown;
  bolloCodice: string | null;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante?: Pagante | null;
  paziente?: Paziente | null;
};

type InvoiceFormProps = {
  invoice?: InvoiceWithRelations;
  payers: Pagante[];
  patients: (Paziente & { pagante?: Pagante | null })[];
  nextInvoiceNumber: number;
  onSuccess?: () => void;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function meseToLabel(mese: Mese): string {
  return mese.charAt(0) + mese.slice(1).toLowerCase();
}

export function InvoiceForm({
  invoice,
  payers,
  patients,
  nextInvoiceNumber,
  onSuccess,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const inv = invoice as InvoiceWithRelations | undefined;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      id_Pagante: inv?.id_Pagante ?? "",
      id_Paziente: inv?.id_Paziente ?? "",
      data: formatDateInput(inv?.data) || formatDateInput(new Date()),
      mod_pag: inv?.mod_pag ?? "",
      sedute: inv?.sedute ?? "",
      commento: inv?.commento ?? "",
      n_fattura: inv?.n_fattura ?? nextInvoiceNumber,
      mesi: inv
        ? inv.mesi.map((m) => ({
            mese: m.mese as Mese,
            prezzo: String(m.prezzo),
          }))
        : [
            {
              mese: format(new Date(), "MMMM", { locale: it }).toUpperCase() as Mese,
              prezzo: "",
            },
          ],
      citta: inv?.citta ?? "",
      cap: inv?.cap ?? "",
      bolloCodice: inv?.bolloCodice ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray<InvoiceFormInput, "mesi">({
    control,
    name: "mesi",
  });

  const selectedPayerId = useWatch({ control, name: "id_Pagante" });
  const selectedDate = useWatch({ control, name: "data" });
  const mesiValues = useWatch({ control, name: "mesi" }) ?? [];
  const bolloCodiceValue = useWatch({ control, name: "bolloCodice" });

  const totale = useMemo(
    () => roundCurrency(mesiValues.reduce((somma, m) => somma + Number(m.prezzo || 0), 0)),
    [mesiValues]
  );

  const bolloRichiesto = totale > SOGLIA_BOLLO;
  const bolloMancante = bolloRichiesto && !bolloCodiceValue;

  const mesiSelezionati = useMemo(
    () => new Set(mesiValues.map((m) => m.mese)),
    [mesiValues]
  );

  const mesiOrdinati = useMemo(
    () =>
      fields
        .map((field, index) => ({ field, index }))
        .sort((a, b) => MESI.indexOf(a.field.mese) - MESI.indexOf(b.field.mese)),
    [fields]
  );

  const filteredPatients = useMemo(() => {
    if (!selectedPayerId) return patients;
    return patients.filter((p) => p.id_Pagante === Number(selectedPayerId));
  }, [selectedPayerId, patients]);

  useEffect(() => {
    if (!selectedPayerId) return;
    const payer = payers.find((p) => p.id === Number(selectedPayerId));
    if (!payer) return;
    setValue("citta", payer.citta);
    setValue("cap", payer.cap);
  }, [selectedPayerId, payers, setValue]);

  useEffect(() => {
    if (invoice) return;
    if (!selectedDate || typeof selectedDate !== "string") return;
    const date = parseDateInput(selectedDate);
    const year = date.getFullYear();
    getNextInvoiceNumberForYear(year).then((nextNumber) => {
      setValue("n_fattura", nextNumber);
    });
  }, [selectedDate, invoice, setValue]);

  const toggleMese = (mese: Mese, checked: boolean) => {
    if (checked) {
      append({ mese, prezzo: "" });
    } else {
      const index = fields.findIndex((f) => f.mese === mese);
      if (index !== -1) remove(index);
    }
  };

  const onSubmit = (data: InvoiceFormData) => {
    setServerError(null);
    startTransition(async () => {
      const result = invoice
        ? await updateInvoice(invoice.id, data)
        : await createInvoice(data);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/invoices");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="n_fattura">N. Fattura</Label>
          <Input
            id="n_fattura"
            type="number"
            {...register("n_fattura")}
            aria-invalid={!!errors.n_fattura}
          />
          {errors.n_fattura && (
            <p className="text-sm text-destructive">
              {errors.n_fattura.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            {...register("data")}
            aria-invalid={!!errors.data}
          />
          {errors.data && (
            <p className="text-sm text-destructive">{errors.data.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mesi di riferimento</Label>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-input p-3 sm:grid-cols-4">
          {MESI.map((m) => {
            const selezionato = mesiSelezionati.has(m);
            return (
              <label
                key={m}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selezionato}
                  onChange={(e) => toggleMese(m, e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                {meseToLabel(m)}
              </label>
            );
          })}
        </div>
        {errors.mesi && typeof errors.mesi.message === "string" && (
          <p className="text-sm text-destructive">{errors.mesi.message}</p>
        )}
      </div>

      {fields.length > 0 && (
        <div className="space-y-2">
          <Label>Importo per ogni mese (€)</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {mesiOrdinati.map(({ field, index }) => (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded-lg border border-input p-2"
              >
                <input
                  type="hidden"
                  {...register(`mesi.${index}.mese` as const)}
                  value={field.mese}
                />
                <span className="w-16 shrink-0 truncate text-sm">
                  {meseToLabel(field.mese)}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  aria-label={`Importo per ${meseToLabel(field.mese)}`}
                  {...register(`mesi.${index}.prezzo` as const)}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 text-sm text-muted-foreground">€</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-input bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <Label>Totale fattura</Label>
          <span className="text-lg font-semibold">
            {formatCurrency(totale)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Il totale è la somma degli importi dei singoli mesi.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bolloCodice">Codice marca da bollo (opzionale)</Label>
        <Input
          id="bolloCodice"
          maxLength={14}
          inputMode="numeric"
          placeholder="14 cifre"
          {...register("bolloCodice")}
          aria-invalid={!!errors.bolloCodice}
        />
        {errors.bolloCodice && (
          <p className="text-sm text-destructive">
            {errors.bolloCodice.message}
          </p>
        )}
        {bolloMancante && (
          <p className="flex items-center gap-1.5 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Il totale supera {formatCurrency(SOGLIA_BOLLO)}: è dovuta la marca
            da bollo da {formatCurrency(IMPORTO_BOLLO)}. Inserisci il codice
            quando disponibile.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <option value="">Seleziona pagante</option>
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

        <div className="space-y-2">
          <Label htmlFor="id_Paziente">Paziente</Label>
          <select
            id="id_Paziente"
            {...register("id_Paziente")}
            className={cn(
              "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              errors.id_Paziente && "border-destructive"
            )}
          >
            <option value="">Seleziona paziente</option>
            {filteredPatients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.cognome} {patient.nome}
              </option>
            ))}
          </select>
          {errors.id_Paziente && (
            <p className="text-sm text-destructive">
              {errors.id_Paziente.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mod_pag">Modalità di pagamento</Label>
          <select
            id="mod_pag"
            {...register("mod_pag")}
            className={cn(
              "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              errors.mod_pag && "border-destructive"
            )}
          >
            <option value="">Seleziona</option>
            <option value="CONTANTI">Contanti</option>
            <option value="CARTA">Carta</option>
            <option value="BONIFICO">Bonifico</option>
          </select>
          {errors.mod_pag && (
            <p className="text-sm text-destructive">
              {errors.mod_pag.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Input
            id="cap"
            {...register("cap")}
            aria-invalid={!!errors.cap}
          />
          {errors.cap && (
            <p className="text-sm text-destructive">{errors.cap.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sedute">N. sedute</Label>
          <Input
            id="sedute"
            type="number"
            min="0"
            {...register("sedute")}
            aria-invalid={!!errors.sedute}
          />
          {errors.sedute && (
            <p className="text-sm text-destructive">
              {errors.sedute.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="commento">Commento</Label>
        <Input id="commento" {...register("commento")} />
      </div>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Salvataggio..."
          : invoice
            ? "Aggiorna fattura"
            : "Crea fattura"}
      </Button>
    </form>
  );
}
