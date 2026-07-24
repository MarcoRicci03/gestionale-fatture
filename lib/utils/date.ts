// Le date sono costruite a mezzogiorno in ora locale DEL PROCESSO. Il fuso è
// pinnato a Europe/Rome (Dockerfile ENV TZ + prefisso TZ sugli script npm)
// così client e server concordano; il mezzogiorno dà comunque margine
// contro lo scivolamento di giorno ai confini del fuso.
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
  const d = toLocalDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateDisplay(
  date: Date | string | null | undefined
): string {
  if (!date) return "-";
  return toLocalDate(date).toLocaleDateString("it-IT");
}
