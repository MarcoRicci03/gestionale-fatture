import { headers } from "next/headers";

export type HeaderReader = { get(name: string): string | null };

// X-Forwarded-For può contenere una catena "client, proxy1, proxy2": il primo
// valore è il client originale SOLO se il reverse proxy davanti all'app lo
// imposta lui stesso (sovrascrivendo quello eventualmente inviato dal
// client). Senza un proxy fidato configurato così, l'header è fornito
// direttamente dal client ed è quindi falsificabile: in quel caso si degrada
// al bucket "unknown", cioè il comportamento pre-fix (nessuna distinzione
// per IP) — non peggiora nulla rispetto a oggi.
export function parseClientIpFromHeaders(headersList: HeaderReader): string {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return parseClientIpFromHeaders(headersList);
}
