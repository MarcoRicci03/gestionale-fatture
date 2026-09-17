import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import crypto from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL non configurato.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret =
    process.env.TS_ENCRYPTION_SECRET ||
    "fallback-dev-secret-sistema-ts-never-use-in-production";

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptCredential(plaintext) {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

async function seed() {
  console.log("1. Pulizia dei vecchi dati...");
  await prisma.trasmissioneTs.deleteMany();
  await prisma.fatturaMese.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.paziente.deleteMany();
  await prisma.pagante.deleteMany();
  await prisma.impostazioniSistemaTs.deleteMany();
  await prisma.auditLog.deleteMany();
  console.log("   Dati rimossi con successo.");

  console.log("2. Configurazione utente admin...");
  const passwordHash = await hash("change-me-min-12-caratteri", 12);
  
  const admin = await prisma.utente.upsert({
    where: { username: "admin" },
    update: {
      passwordHash,
      isAdmin: true,
      abilitato: true,
      mustChangePassword: false,
      nome: "Mario",
      cognome: "Rossi",
      cf: "MTOMRA66A41G224M",
      pIva: "65498732105",
      titolo: "Dott.",
      specializzazione: "Psicologo Psicoterapeuta",
      citta: "Roma",
      cap: "00100",
      provincia: "RM",
      via: "Via Roma 1",
    },
    create: {
      username: "admin",
      passwordHash,
      isAdmin: true,
      abilitato: true,
      mustChangePassword: false,
      nome: "Mario",
      cognome: "Rossi",
      cf: "MTOMRA66A41G224M",
      pIva: "65498732105",
      titolo: "Dott.",
      specializzazione: "Psicologo Psicoterapeuta",
      citta: "Roma",
      cap: "00100",
      provincia: "RM",
      via: "Via Roma 1",
    },
  });
  console.log(`   Utente admin (id: ${admin.id}) configurato con profilo fiscale completo.`);

  console.log("3. Configurazione credenziali di collaudo Sistema TS...");
  await prisma.impostazioniSistemaTs.upsert({
    where: { id_Utente: admin.id },
    update: {
      username: "MTOMRA66A41G224M",
      passwordEncrypted: encryptCredential("Salve123"),
      pincodeEncrypted: encryptCredential("3489543096"),
      codiceRegione: null,
      codiceAsl: null,
      codiceStruttura: null,
      naturaIvaDefault: "N2.2",
    },
    create: {
      id_Utente: admin.id,
      username: "MTOMRA66A41G224M",
      passwordEncrypted: encryptCredential("Salve123"),
      pincodeEncrypted: encryptCredential("3489543096"),
      codiceRegione: null,
      codiceAsl: null,
      codiceStruttura: null,
      naturaIvaDefault: "N2.2",
    },
  });
  console.log("   Credenziali Sistema TS salvate e cifrate con AES-256-GCM.");

  console.log("4. Creazione paganti e pazienti...");
  // Pagante 1: Luigi Bianchi (paziente coincide)
  const pagante1 = await prisma.pagante.create({
    data: {
      id_Utente: admin.id,
      nome: "Luigi",
      cognome: "Bianchi",
      cf: "BNCLGI75C12F205E",
      via: "Via Garibaldi 10",
      citta: "Milano",
      cap: "20121",
    },
  });
  const paziente1 = await prisma.paziente.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante1.id,
      nome: "Luigi",
      cognome: "Bianchi",
    },
  });

  // Pagante 2: Paolo Forni (genitore di Andrea Forni minore)
  const pagante2 = await prisma.pagante.create({
    data: {
      id_Utente: admin.id,
      nome: "Paolo",
      cognome: "Forni",
      cf: "FRNPLA78D15H501F",
      via: "Via Dante 5",
      citta: "Roma",
      cap: "00185",
    },
  });
  const paziente2 = await prisma.paziente.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante2.id,
      nome: "Andrea",
      cognome: "Forni",
    },
  });

  // Pagante 3: Laura Verdi
  const pagante3 = await prisma.pagante.create({
    data: {
      id_Utente: admin.id,
      nome: "Laura",
      cognome: "Verdi",
      cf: "VRDLDA85M41H501O",
      via: "Corso Italia 22",
      citta: "Torino",
      cap: "10121",
    },
  });
  const paziente3 = await prisma.paziente.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante3.id,
      nome: "Laura",
      cognome: "Verdi",
    },
  });

  // Pagante 4: Giuseppe Rossi (con CIN errato volutamente 'X' invece di 'A' per test di validazione)
  const pagante4 = await prisma.pagante.create({
    data: {
      id_Utente: admin.id,
      nome: "Giuseppe",
      cognome: "Rossi",
      cf: "RSSGPP90A01H501X",
      via: "Via Napoli 8",
      citta: "Napoli",
      cap: "80100",
    },
  });
  const paziente4 = await prisma.paziente.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante4.id,
      nome: "Giuseppe",
      cognome: "Rossi",
    },
  });
  console.log("   4 paganti e 4 pazienti creati.");

  console.log("5. Creazione fatture con scenari variegati per Sistema TS...");
  
  // Fattura 1: Standard con bollo valido > 77.47
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante1.id,
      id_Paziente: paziente1.id,
      n_fattura: 1,
      anno: 2026,
      data: new Date("2026-02-10"),
      prezzo_totale: new Prisma.Decimal(100.0),
      bollo: new Prisma.Decimal(2.0),
      bolloCodice: "01234567890123",
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      stato_ts: "DA_INVIARE",
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "FEBBRAIO", prezzo: new Prisma.Decimal(100.0) }],
      },
    },
  });

  // Fattura 2: Minore (genitore pagante) sotto soglia senza bollo
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante2.id,
      id_Paziente: paziente2.id,
      n_fattura: 2,
      anno: 2026,
      data: new Date("2026-02-15"),
      prezzo_totale: new Prisma.Decimal(60.0),
      bollo: new Prisma.Decimal(0.0),
      bolloCodice: null,
      mod_pag: "CARTA",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      stato_ts: "DA_INVIARE",
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "FEBBRAIO", prezzo: new Prisma.Decimal(60.0) }],
      },
    },
  });

  // Fattura 3: Bollo dovuto (> 77.47) ma codice mancante + natura IVA N4 (esente art. 10)
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante3.id,
      id_Paziente: paziente3.id,
      n_fattura: 3,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal(150.0),
      bollo: new Prisma.Decimal(2.0),
      bolloCodice: null, // Codice mancante!
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N4",
      flag_opposizione: false,
      stato_ts: "DA_INVIARE",
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "MARZO", prezzo: new Prisma.Decimal(150.0) }],
      },
    },
  });

  // Fattura 4: Con flag opposizione del cittadino attivo
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante1.id,
      id_Paziente: paziente1.id,
      n_fattura: 4,
      anno: 2026,
      data: new Date("2026-03-10"),
      prezzo_totale: new Prisma.Decimal(80.0),
      bollo: new Prisma.Decimal(2.0),
      bolloCodice: "98765432109876",
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: true, // Opposizione!
      stato_ts: "DA_INVIARE",
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "MARZO", prezzo: new Prisma.Decimal(80.0) }],
      },
    },
  });

  // Fattura 5: CF errato (mostra badge rosso di errore nella lista TS) + contanti non tracciati
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante4.id,
      id_Paziente: paziente4.id,
      n_fattura: 5,
      anno: 2026,
      data: new Date("2026-03-20"),
      prezzo_totale: new Prisma.Decimal(90.0),
      bollo: new Prisma.Decimal(2.0),
      bolloCodice: "55555555555555",
      mod_pag: "CONTANTI",
      pagamento_tracciato: false, // Non tracciato
      natura_iva: "N2.2",
      flag_opposizione: false,
      stato_ts: "DA_INVIARE",
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "MARZO", prezzo: new Prisma.Decimal(90.0) }],
      },
    },
  });

  // Fattura 6: Già inviata in precedenza (per testare annullamento / cancellazione TS)
  await prisma.pagamento.create({
    data: {
      id_Utente: admin.id,
      id_Pagante: pagante3.id,
      id_Paziente: paziente3.id,
      n_fattura: 6,
      anno: 2026,
      data: new Date("2026-04-05"),
      prezzo_totale: new Prisma.Decimal(120.0),
      bollo: new Prisma.Decimal(2.0),
      bolloCodice: "77777777777777",
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      stato_ts: "INVIATA",
      protocollo_ts: "260912000000001",
      data_invio_ts: new Date(),
      citta: "Roma",
      cap: "00100",
      mesi: {
        create: [{ mese: "APRILE", prezzo: new Prisma.Decimal(120.0) }],
      },
    },
  });

  console.log("   6 fatture di test create con successo!");
  console.log("\nRiepilogo pronto:");
  console.log("- Login: username 'admin', password 'change-me-min-12-caratteri'");
  console.log("- Profilo admin pre-configurato con CF e P.IVA (pronto per TS)");
  console.log("- Impostazioni TS già compilate con credenziali di collaudo ministeriali cifrate");
  console.log("- 5 fatture DA INVIARE (con scenari di bollo, opposizione, CF non valido, pagante/paziente)");
  console.log("- 1 fattura INVIATA (per testare l'annullamento)");
}

seed()
  .catch((err) => {
    console.error("Errore durante il seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
