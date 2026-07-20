import { format } from "date-fns";
import { it } from "date-fns/locale";

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function toLocalDate(date: Date | string): Date {
  if (typeof date !== "string") return date;
  // "yyyy-MM-dd" (o "yyyy-MM-ddTHH:mm:ss...Z") va interpretato come data
  // civile, non come istante UTC: new Date(stringa) su un input date-only
  // lo tratta come mezzanotte UTC, che in fusi con offset negativo mostra
  // il giorno precedente. Si estraggono i componenti e si costruisce la
  // data in ora locale, come già fa parseDateInput.
  const datePart = date.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(toLocalDate(date), "yyyy-MM-dd");
}

export function formatDateDisplay(
  date: Date | string | null | undefined
): string {
  if (!date) return "-";
  return format(toLocalDate(date), "dd/MM/yyyy", { locale: it });
}
