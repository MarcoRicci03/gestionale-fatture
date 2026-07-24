import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Nessuna fetch/XHR verso domini esterni nel codebase, nessun uso di
// next/image con pattern remoti, i font (next/font/google) sono
// self-hosted a build time: uno script-src/style-src/connect-src limitati a
// 'self' non rompono nulla di reale. 'unsafe-inline' resta necessario per lo
// script di bootstrap dell'hydration che Next.js inietta inline nell'HTML
// (self.__next_f.push(...)): una CSP "strict" con nonce per-richiesta
// eliminerebbe anche questo, ma richiede generare il nonce in proxy.ts e
// propagarlo nei Server Component — fuori scope per questo fix, la
// differenza rispetto a nessuna CSP resta comunque sostanziale (blocca il
// caricamento di script/risorse da domini esterni in caso di un futuro
// XSS).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
  // CSP e HSTS solo in produzione: in sviluppo Turbopack inietta script
  // eval-based e un websocket di HMR che una CSP stretta bloccherebbe, senza
  // alcun beneficio reale su un ambiente locale non esposto. HSTS non ha
  // effetto se la risposta non arriva già su HTTPS (i browser lo ignorano su
  // HTTP semplice), ma non ha senso forzarlo mentre si sviluppa in locale.
  ...(isProduction
    ? [
        { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        {
          key: "Strict-Transport-Security",
          value: "max-age=15552000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.0.56'],
  output: "standalone",
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
