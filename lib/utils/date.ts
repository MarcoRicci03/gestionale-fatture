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

/**
 * Inserisce automaticamente i separatori '/' per date nel formato GG/MM/AAAA durante la digitazione.
 * Gestisce cancellazioni (backspace), immissione progressiva di sole cifre e formati incollati.
 */
export function maskDateInput(rawValue: string, prevValue = ""): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  // Supporto copia-incolla formato ISO YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Supporto copia-incolla formato D/M/YYYY o DD-MM-YYYY / DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Se l'utente preme Backspace su uno slash finale (es. "01/" -> "01" o "01/03/" -> "01/03")
  let val = rawValue;
  if (prevValue.endsWith("/") && val === prevValue.slice(0, -1)) {
    val = val.slice(0, -1);
  }

  // Se l'utente digita manualmente uno slash dopo 1 cifra del giorno (es. "1/" -> "01/")
  if (/^\d\/$/.test(val)) {
    return `0${val}`;
  }
  // Se l'utente digita manualmente uno slash dopo 1 cifra del mese (es. "01/3/" -> "01/03/")
  if (/^\d{2}\/\d\/$/.test(val)) {
    return `${val.slice(0, 3)}0${val.slice(3)}`;
  }

  // Estrae solo le cifre numeriche (massimo 8: 2 giorno, 2 mese, 4 anno)
  const digits = val.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";

  if (digits.length <= 2) {
    if (digits.length === 2 && val.length >= prevValue.length) {
      return `${digits}/`;
    }
    return digits;
  }

  if (digits.length <= 4) {
    const day = digits.slice(0, 2);
    const month = digits.slice(2);
    if (digits.length === 4 && val.length >= prevValue.length) {
      return `${day}/${month}/`;
    }
    return `${day}/${month}`;
  }

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${day}/${month}/${year}`;
}

