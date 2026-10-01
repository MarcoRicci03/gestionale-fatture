import type { Prisma } from "@prisma/client";

export type SerializedMese<M> = Omit<M, "prezzo"> & { prezzo: number };

export type SerializedInvoice<T> = Omit<T, "prezzo_totale" | "bollo" | "mesi"> & {
  prezzo_totale: number;
  bollo: number;
  mesi: T extends { mesi: Array<infer M> } ? Array<SerializedMese<M>> : Array<{ prezzo: number }>;
};

/**
 * Converte i campi `Decimal` di Prisma in `number` nativi JavaScript (DRY-03).
 * Previene errori di serializzazione Server-Client per `prezzo_totale`, `bollo` e `mesi[].prezzo`.
 */
export function serializeInvoiceNumbers<
  T extends {
    prezzo_totale: Prisma.Decimal | number;
    bollo?: Prisma.Decimal | number | null;
    mesi?: Array<{ prezzo: Prisma.Decimal | number; [k: string]: unknown }>;
  },
>(invoice: T): SerializedInvoice<T> {
  const { prezzo_totale, bollo, mesi, ...rest } = invoice;
  return {
    ...(rest as Omit<T, "prezzo_totale" | "bollo" | "mesi">),
    prezzo_totale:
      typeof prezzo_totale === "number" ? prezzo_totale : prezzo_totale.toNumber(),
    bollo:
      bollo == null ? 0 : typeof bollo === "number" ? bollo : bollo.toNumber(),
    mesi: (mesi
      ? mesi.map((m) => {
          const { prezzo, ...mRest } = m;
          return {
            ...mRest,
            prezzo: typeof prezzo === "number" ? prezzo : prezzo.toNumber(),
          };
        })
      : []) as SerializedInvoice<T>["mesi"],
  };
}
