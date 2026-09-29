// Vale per ogni id di tabella (fatture, paganti, pazienti, utenti,
// trasmissioni), sia da URL param sia da argomento di una server action, che
// è un endpoint RPC pubblico e può ricevere qualunque valore (P016).
// Number.isNaN da solo non basta a validare un id da URL param:
// Number("Infinity") -> Infinity (non NaN, non intero), Number("1e12") -> un
// intero fuori dal range int4 di Postgres. In entrambi i casi Prisma lancia
// un'eccezione non catturata invece di restituire semplicemente "non trovato".
export function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
