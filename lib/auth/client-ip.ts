import { headers } from "next/headers";

export type HeaderReader = { get(name: string): string | null };

// In produzione il traffico pubblico passa da un Cloudflare Tunnel: Cloudflare
// imposta CF-Connecting-IP lui stesso sull'edge, sovrascrivendo qualunque
// valore che il client provi a inviare — è l'unico header di questa lista non
// falsificabile in quella topologia. X-Forwarded-For invece viene ACCODATO
// (non sovrascritto) sia da Cloudflare sia dal template nginx di default di
// Nginx Proxy Manager: un client che invia già un proprio X-Forwarded-For
// finisce per comparire come primo elemento della catena "client, proxy1,
// proxy2", davanti al valore vero aggiunto dai proxy successivi. Per questo
// va letto CF-Connecting-IP quando presente; X-Forwarded-For/X-Real-IP
// restano un fallback per topologie senza Cloudflare, valido solo se il
// reverse proxy davanti all'app è configurato per sovrascrivere l'header
// invece di accodarlo. Senza un proxy fidato configurato così, questi header
// sono forniti direttamente dal client ed è quindi falsificabile: un
// attaccante potrebbe ottenere una chiave (username, ip) diversa a ogni
// tentativo di login e aggirare così il lockout di lib/auth/rate-limit.ts.
// Per questo `resolveClientIp` legge questi header SOLO se TRUSTED_PROXY=true
// è impostato esplicitamente in env: senza un proxy davanti che li imposta
// lui stesso, degradano al bucket "unknown" (nessuna distinzione per IP, ma
// nemmeno un bypass del rate limit — vedi anche USERNAME_MAX_ATTEMPTS in
// lib/auth/rate-limit.ts come rete di sicurezza indipendente da questa
// configurazione).
export function isTrustedProxyEnabled(): boolean {
  return process.env.TRUSTED_PROXY === "true";
}

export function parseClientIpFromHeaders(headersList: HeaderReader): string {
  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim();
  }

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
