import { Prisma } from "@prisma/client";

// Con l'adapter @prisma/adapter-pg (driver adapter, non l'engine binario) i
// nomi dei campi in violazione di un vincolo P2002 non sono in error.meta.target
// (che qui resta undefined) ma annidati in error.meta.driverAdapterError.cause
// .constraint.fields, con eventuali virgolette attorno agli identificatori
// case-sensitive di Postgres (es. `"id_Utente"`).
export function isUniqueViolationOnField(
  error: unknown,
  fieldName: string
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: unknown } };
        };
      }
    | undefined;

  if (Array.isArray(meta?.target) && meta.target.includes(fieldName)) {
    return true;
  }

  const fields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) {
    return fields.some(
      (f) => typeof f === "string" && f.replace(/"/g, "") === fieldName
    );
  }

  return false;
}
