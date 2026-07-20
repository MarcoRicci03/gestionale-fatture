import { headers } from "next/headers";

export type HeaderReader = { get(name: string): string | null };

// X-Forwarded-For può contenere una catena "client, proxy1, proxy2": il primo
// valore è il client originale SOLO se il reverse proxy davanti all'app lo
// imposta lui stesso (sovrascrivendo quello eventualmente inviato dal
// client). Senza un proxy fidato configurato così, l'header è fornito
// direttamente dal client ed è quindi falsificabile: un attaccante potrebbe
// ottenere una chiave (username, ip) diversa a ogni tentativo di login e
// aggirare così il lockout di lib/auth/rate-limit.ts. Per questo
// `resolveClientIp` legge questi header SOLO se TRUSTED_PROXY=true è
// impostato esplicitamente in env: senza un proxy davanti che li imposta lui
// stesso, degradano al bucket "unknown" (nessuna distinzione per IP, ma
// nemmeno un bypass del rate limit — vedi anche USERNAME_MAX_ATTEMPTS in
// lib/auth/rate-limit.ts come rete di sicurezza indipendente da questa
// configurazione).
export function isTrustedProxyEnabled(): boolean {
  return process.env.TRUSTED_PROXY === "true";
}

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

export function resolveClientIp(
  headersList: HeaderReader,
  trustedProxy: boolean
): string {
  if (!trustedProxy) {
    return "unknown";
  }
  return parseClientIpFromHeaders(headersList);
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return resolveClientIp(headersList, isTrustedProxyEnabled());
}
