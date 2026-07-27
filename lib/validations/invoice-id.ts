// Number.isNaN da solo non basta a validare un id da URL param:
// Number("Infinity") -> Infinity (non NaN, non intero), Number("1e12") -> un
// intero fuori dal range int4 di Postgres. In entrambi i casi Prisma lancia
// un'eccezione non catturata invece di restituire semplicemente "non trovato".
export function isValidInvoiceId(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
