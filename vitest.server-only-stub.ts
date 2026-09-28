// Sostituisce il pacchetto "server-only" nei test Vitest. Il pacchetto vero
// lancia all'import fuori dal bundle react-server di Next, quindi ogni test che
// importa lib/data/* (direttamente o tramite le action) fallirebbe.
export {};
