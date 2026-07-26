// Alfabeto senza caratteri visivamente ambigui: la password temporanea viene
// letta, dettata o riscritta a mano dall'admin, quindi 0/O e 1/l/I/i sono
// esclusi. 56 simboli × 16 caratteri utili ≈ 92 bit di entropia, ampiamente
// sopra qualunque soglia sensata per una credenziale a vita breve.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_SIZE = 4;
const GROUP_COUNT = 4;

// Rejection sampling: 256 non è multiplo di ALPHABET.length, quindi un banale
// `byte % alphabet.length` favorirebbe leggermente i primi caratteri
// dell'alfabeto. Si scarta ogni byte oltre il più grande multiplo di
// ALPHABET.length che sta in 256, così ogni carattere resta equiprobabile.
function randomChar(): string {
  const maxUsable = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const bytes = new Uint8Array(1);
  let byte: number;
  do {
    crypto.getRandomValues(bytes);
    byte = bytes[0];
  } while (byte >= maxUsable);
  return ALPHABET[byte % ALPHABET.length];
}

export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = "";
    for (let i = 0; i < GROUP_SIZE; i++) {
      group += randomChar();
    }
    groups.push(group);
  }
  return groups.join("-");
}
