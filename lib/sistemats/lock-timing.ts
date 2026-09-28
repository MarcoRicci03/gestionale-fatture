// CR-11: le due soglie dipendono l'una dall'altra e stanno insieme.
//
// Oltre STALE_LOCK_MINUTES un lock IN_TRASMISSIONE è considerato orfano, cioè
// senza chiamata a Sogei ancora in volo. Vale solo se inviaFile non dura mai
// più di MAX_DURATA_INVIO_MS (tentativi + attese), che deve restare sotto la
// soglia: lo verifica client.test.ts.
export const STALE_LOCK_MINUTES = 5;
export const MAX_DURATA_INVIO_MS = 4 * 60_000;
