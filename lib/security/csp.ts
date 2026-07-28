// CSP applicata da proxy.ts, solo in produzione (SEC-08). style-src resta
// 'unsafe-inline': components/settings/pdf-editor*.tsx usa style={{...}}
// per il posizionamento a pixel del canvas drag-and-drop, e un nonce non
// copre l'attributo HTML `style`, solo i tag <style> — vedi
// PIANO_FIX_CSP_NONCE.md.
export function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
