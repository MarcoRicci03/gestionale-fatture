import { format } from "date-fns";
import { it } from "date-fns/locale";

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function formatDateDisplay(
  date: Date | string | null | undefined
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: it });
}
