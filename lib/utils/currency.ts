// Elimina l'errore di virgola mobile (es. 0.1 + 0.2 !== 0.3) dopo una somma di importi in JS.
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
