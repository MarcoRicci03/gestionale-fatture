import { createRateLimiter } from "@/lib/auth/rate-limiter";

// Rate limiter per le trasmissioni telematiche verso Sogei (invio lotti e cancellazioni).
// Max 10 richieste al minuto per utente. Previene blocchi WAF o sospensioni dell'utenza.
export const sistemaTsTransmissionLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
});

// Rate limiter per le interrogazioni di verifica esito verso Sogei.
// Max 15 verifiche al minuto per utente per prevenire polling compulsivo.
export const sistemaTsSyncLimiter = createRateLimiter({
  maxRequests: 15,
  windowMs: 60 * 1000,
});

export function resetSistemaTsRateLimiters(): void {
  sistemaTsTransmissionLimiter.reset();
  sistemaTsSyncLimiter.reset();
}
