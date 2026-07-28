import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// La CSP (SEC-08) non è più qui: serve un nonce diverso per ogni richiesta
// per poter togliere 'unsafe-inline' da script-src, e headers() qui sotto
// viene valutato una sola volta al build/route-registration, senza accesso
// alla request corrente. È generata in proxy.ts (buildCspHeader in
// lib/security/csp.ts), solo in produzione — vedi PIANO_FIX_CSP_NONCE.md.
const securityHeaders = [
  // Ridondante con "frame-ancestors 'none'" sopra: X-Frame-Options resta
  // rispettato da client più vecchi che non implementano CSP3.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS solo in produzione: non ha effetto se la risposta non arriva già
  // su HTTPS (i browser lo ignorano su HTTP semplice), ma non ha senso
  // forzarlo mentre si sviluppa in locale.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=15552000; includeSubDomains",
        },
      ]
    : []),
];

// Origini extra (oltre a localhost) da cui il dev server accetta richieste,
// utile per testare da un altro dispositivo sulla stessa LAN (vedi
// allowedDevOrigins in next.config.ts). Specifico della macchina di chi
// sviluppa: va impostato in .env, non cablato qui (DEP-09).
const devAllowedOrigins = process.env.DEV_ALLOWED_ORIGINS
  ? process.env.DEV_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: devAllowedOrigins,
  output: "standalone",
  // Senza questo, Next.js aggiunge di default l'header X-Powered-By:
  // Next.js a ogni risposta, rivelando il framework e indirettamente la
  // superficie di advisory applicabili (SEC-01/SEC-07).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
