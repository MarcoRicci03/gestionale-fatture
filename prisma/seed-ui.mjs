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

// Calcolo CIN conforme all'algoritmo del Codice Fiscale
function computeCin(base15) {
  const ODD = {
    "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
    K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
    U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
  };
  const EVEN = {
    "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
    K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
    U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
  };
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = base15[i].toUpperCase();
    sum += (i % 2 === 0 ? ODD[c] : EVEN[c]) || 0;
  }
  return String.fromCharCode(65 + (sum % 26));
}

function makeValidCf(base15) {
  return `${base15.toUpperCase()}${computeCin(base15)}`;
}

const MESI_ENUM = [
  "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
  "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE",
];

const ANAGRAFICHE = [
  { nome: "Mario", cognome: "Rossi", base15: "RSSMRA85M01H501", citta: "Roma", cap: "00185", via: "Via Nazionale 12" },
  { nome: "Luigi", cognome: "Bianchi", base15: "BNCLGI75C12F205", citta: "Milano", cap: "20121", via: "Corso Buenos Aires 45" },
  { nome: "Giuseppe", cognome: "Verdi", base15: "VRDGPP60A15L219", citta: "Torino", cap: "10122", via: "Via Po 18" },
  { nome: "Paolo", cognome: "Forni", base15: "FRNPLA78D15H501", citta: "Roma", cap: "00185", via: "Via Dante 5" },
  { nome: "Laura", cognome: "Neri", base15: "NRELRA92E50F205", citta: "Milano", cap: "20129", via: "Viale Piave 8" },
  { nome: "Chiara", cognome: "Ferrari", base15: "FRRCHR88M45L219", citta: "Torino", cap: "10128", via: "Corso Francia 34" },
  { nome: "Alessandro", cognome: "Romano", base15: "RMNLSN82C10F839", citta: "Napoli", cap: "80121", via: "Via Toledo 105" },
  { nome: "Francesca", cognome: "Colombo", base15: "CLMFNC95H52F205", citta: "Monza", cap: "20900", via: "Via Manzoni 14" },
  { nome: "Roberto", cognome: "Ricci", base15: "RCCRRT79T18D612", citta: "Firenze", cap: "50123", via: "Via dei Calzaiuoli 7" },
  { nome: "Elena", cognome: "Marino", base15: "MRNLNE84P60A944", citta: "Bologna", cap: "40121", via: "Via Indipendenza 23" },
  { nome: "Davide", cognome: "Greco", base15: "GRCDVD90A05C351", citta: "Catania", cap: "95124", via: "Via Etnea 88" },
  { nome: "Silvia", cognome: "Conti", base15: "CNTSLV86L42D969", citta: "Genova", cap: "16121", via: "Via XX Settembre 40" },
  { nome: "Simone", cognome: "De Luca", base15: "DLCSMN93R14F839", citta: "Napoli", cap: "80133", via: "Corso Umberto I 52" },
  { nome: "Sara", cognome: "Mancini", base15: "MNCSRA89B55H501", citta: "Roma", cap: "00152", via: "Viale Trastevere 99" },
  { nome: "Andrea", cognome: "Costa", base15: "CSTNDR81P20H501", citta: "Roma", cap: "00161", via: "Via Nomentana 150" },
  { nome: "Valentina", cognome: "Giordano", base15: "GRDVNT94C62L219", citta: "Torino", cap: "10138", via: "Corso Vittorio 80" },
  { nome: "Matteo", cognome: "Rizzo", base15: "RZZMTT87E09F205", citta: "Milano", cap: "20144", via: "Via Solari 22" },
  { nome: "Federica", cognome: "Lombardi", base15: "LMBFDC91S58D612", citta: "Firenze", cap: "50129", via: "Viale Lavagnini 19" },
  { nome: "Marco", cognome: "Moretti", base15: "MRTMRC77H12A944", citta: "Bologna", cap: "40126", via: "Via Zamboni 31" },
  { nome: "Anna", cognome: "Barbieri", base15: "BRBNNA83D48C351", citta: "Catania", cap: "95128", via: "Viale Jonio 45" },
];

async function seedUi() {
  console.log("=== SEED UI: GENERAZIONE DI OLTRE 100 FATTURE VARIEGATE ===");

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
      specializzazione: "Logopedista e Neuropsicologo",
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
      specializzazione: "Logopedista e Neuropsicologo",
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
  console.log("   Credenziali Sistema TS salvate e cifrate.");

  console.log("4. Creazione paganti e pazienti...");
  const createdPairs = [];

  for (let i = 0; i < ANAGRAFICHE.length; i++) {
    const p = ANAGRAFICHE[i];
    // Il 4° pagante (Giuseppe Rossi) avrà CIN volutamente errato per testare l'indicatore di alert rosso
    let cf = makeValidCf(p.base15);
    if (i === 3) {
      cf = `${p.base15}X`; // CIN forzato errato
    }

    const pagante = await prisma.pagante.create({
      data: {
        id_Utente: admin.id,
        nome: p.nome,
        cognome: p.cognome,
        cf,
        via: p.via,
        citta: p.citta,
        cap: p.cap,
      },
    });

    // Per il secondo pagante creiamo un minore come paziente (es. figlio minore)
    const isMinor = i === 1;
    const pazienteNome = isMinor ? "Giacomo" : p.nome;
    const pazienteCognome = p.cognome;

    const paziente = await prisma.paziente.create({
      data: {
        id_Utente: admin.id,
        id_Pagante: pagante.id,
        nome: pazienteNome,
        cognome: pazienteCognome,
      },
    });

    createdPairs.push({
      pagante,
      paziente,
      hasInvalidCf: i === 3,
    });
  }
  console.log(`   ${createdPairs.length} coppie pagante/paziente create.`);

  console.log("5. Creazione trasmissioni di esempio nello storico...");
  const trasmissioni = [
    await prisma.trasmissioneTs.create({
      data: {
        id_Utente: admin.id,
        protocollo: "2026021500000001",
        nomeFile: "invio_lotto_2026_01.zip",
        dataInvio: new Date("2026-02-15T10:30:00Z"),
        statoElaborazione: "2", // Accolto
        codiceEsito: "ES01",
        descrizioneEsito: "Elaborazione completata con successo",
        numRicevuti: 15,
        numAccolti: 15,
        numScartati: 0,
      },
    }),
    await prisma.trasmissioneTs.create({
      data: {
        id_Utente: admin.id,
        protocollo: "2026030100000002",
        nomeFile: "invio_lotto_2026_02.zip",
        dataInvio: new Date("2026-03-01T14:15:00Z"),
        statoElaborazione: "3", // Accolto con segnalazioni
        codiceEsito: "ES02",
        descrizioneEsito: "Accolto con segnalazioni non bloccanti",
        numRicevuti: 10,
        numAccolti: 9,
        numScartati: 1,
      },
    }),
    await prisma.trasmissioneTs.create({
      data: {
        id_Utente: admin.id,
        protocollo: "2026031500000003",
        nomeFile: "invio_lotto_2026_03.zip",
        dataInvio: new Date("2026-03-15T09:00:00Z"),
        statoElaborazione: "0", // In elaborazione
        codiceEsito: null,
        descrizioneEsito: "File in elaborazione da parte di Sogei",
        numRicevuti: 5,
        numAccolti: null,
        numScartati: 0,
      },
    }),
  ];
  console.log(`   ${trasmissioni.length} trasmissioni storiche create.`);

  console.log("6. Generazione di 105 fatture realistiche (2025 e 2026)...");

  // Creiamo 35 fatture nel 2025 e 70 fatture nel 2026
  let globalCount = 0;

  // --- ANNO 2025: 35 fatture (1..35) ---
  for (let n = 1; n <= 35; n++) {
    const pair = createdPairs[(n - 1) % createdPairs.length];
    const monthIndex = Math.min(11, Math.floor(((n - 1) * 12) / 35));
    const meseNome = MESI_ENUM[monthIndex];
    const day = ((n * 3) % 27) + 1;
    const data = new Date(Date.UTC(2025, monthIndex, day));

    // Prezzi vari: 40, 60, 80, 100, 120, 150
    const prezzi = [45.0, 60.0, 75.0, 85.0, 100.0, 120.0, 150.0];
    const prezzo = prezzi[n % prezzi.length];
    const richiedeBollo = prezzo > 77.47;
    const bollo = richiedeBollo ? new Prisma.Decimal(2.0) : new Prisma.Decimal(0.0);
    const bolloCodice = richiedeBollo ? `0120250000${String(n).padStart(4, "0")}` : null;

    const modPag = n % 5 === 0 ? "CONTANTI" : n % 3 === 0 ? "CARTA" : "BONIFICO";
    const tracciato = modPag !== "CONTANTI";
    const naturaIva = n % 10 === 0 ? "N4" : "N2.2";

    // Nel 2025 la maggior parte sono già inviate o archiviate
    let statoTs = "INVIATA";
    let protocolloTs = `2025${String(n).padStart(8, "0")}`;
    let trasmissioneId = trasmissioni[0].id;

    if (n === 35) {
      statoTs = "ANNULLATA_TS";
      protocolloTs = "202500000035";
    }

    const snapshotAnagrafica = {
      pagante: {
        nome: pair.pagante.nome,
        cognome: pair.pagante.cognome,
        via: pair.pagante.via,
        citta: pair.pagante.citta,
        cap: pair.pagante.cap,
        cf: pair.pagante.cf,
        piva: null,
      },
      paziente: {
        nome: pair.paziente.nome,
        cognome: pair.paziente.cognome,
      },
    };

    await prisma.pagamento.create({
      data: {
        id_Utente: admin.id,
        id_Pagante: pair.pagante.id,
        id_Paziente: pair.paziente.id,
        n_fattura: n,
        anno: 2025,
        data,
        prezzo_totale: new Prisma.Decimal(prezzo),
        bollo,
        bolloCodice,
        mod_pag: modPag,
        pagamento_tracciato: tracciato,
        sedute: (n % 3) + 1,
        commento: `Seduta riabilitativa logopedica (${meseNome.toLowerCase()} 2025)`,
        natura_iva: naturaIva,
        flag_opposizione: false,
        stato_ts: statoTs,
        protocollo_ts: protocolloTs,
        data_invio_ts: new Date(data.getTime() + 86400000),
        trasmissioniTs: trasmissioneId ? { connect: [{ id: trasmissioneId }] } : undefined,
        citta: pair.pagante.citta,
        cap: pair.pagante.cap,
        snapshotAnagrafica,
        mesi: {
          create: [{ mese: meseNome, prezzo: new Prisma.Decimal(prezzo) }],
        },
      },
    });

    globalCount++;
  }
  console.log(`   35 fatture create per l'anno 2025.`);

  // --- ANNO 2026: 70 fatture (1..70) ---
  for (let n = 1; n <= 70; n++) {
    const pair = createdPairs[(n - 1) % createdPairs.length];
    // Distribuzione nei primi 9 mesi del 2026 (Gennaio - Settembre)
    const monthIndex = Math.min(8, Math.floor(((n - 1) * 9) / 70));
    const meseNome = MESI_ENUM[monthIndex];
    const day = ((n * 4) % 27) + 1;
    const data = new Date(Date.UTC(2026, monthIndex, day));

    const prezzi = [50.0, 65.0, 75.0, 80.0, 95.0, 110.0, 130.0, 160.0];
    const prezzo = prezzi[n % prezzi.length];
    const richiedeBollo = prezzo > 77.47;
    const bollo = richiedeBollo ? new Prisma.Decimal(2.0) : new Prisma.Decimal(0.0);

    // Variazioni bollo:
    // Per n = 12: richiede bollo ma bolloCodice = null (bollo mancante!)
    // Per gli altri: codice generato regolarmente
    let bolloCodice = null;
    if (richiedeBollo) {
      if (n !== 12) {
        bolloCodice = `0120260000${String(n).padStart(4, "0")}`;
      }
    }

    const modPag = n % 6 === 0 ? "CONTANTI" : n % 3 === 0 ? "CARTA" : "BONIFICO";
    const tracciato = modPag !== "CONTANTI";
    const naturaIva = n % 8 === 0 ? "N4" : "N2.2";

    // Opposizione cittadino per n = 15 e n = 30
    const flagOpposizione = n === 15 || n === 30;

    // Distribuzione variegata degli stati Sistema TS per testare i filtri UI:
    let statoTs = "DA_INVIARE";
    let protocolloTs = null;
    let dataInvioTs = null;
    let trasmissioneId = null;

    if (n <= 15) {
      // 15 già inviate e accolte
      statoTs = "INVIATA";
      protocolloTs = `2026021500000001`;
      dataInvioTs = new Date("2026-02-15T10:30:00Z");
      trasmissioneId = trasmissioni[0].id;
    } else if (n <= 20) {
      // 5 in trasmissione
      statoTs = "IN_TRASMISSIONE";
      protocolloTs = `2026031500000003`;
      dataInvioTs = new Date("2026-03-15T09:00:00Z");
      trasmissioneId = trasmissioni[2].id;
    } else if (n === 21 || n === 22) {
      // 2 da cancellare
      statoTs = "DA_CANCELLARE_SU_TS";
      protocolloTs = `2026030100000002`;
      trasmissioneId = trasmissioni[1].id;
    } else if (n === 23) {
      // 1 annullata
      statoTs = "ANNULLATA_TS";
      protocolloTs = `2026030100000002`;
      trasmissioneId = trasmissioni[1].id;
    } else {
      // Tutte le altre (circa 47 fatture) DA_INVIARE
      statoTs = "DA_INVIARE";
    }

    const snapshotAnagrafica = {
      pagante: {
        nome: pair.pagante.nome,
        cognome: pair.pagante.cognome,
        via: pair.pagante.via,
        citta: pair.pagante.citta,
        cap: pair.pagante.cap,
        cf: pair.pagante.cf,
        piva: null,
      },
      paziente: {
        nome: pair.paziente.nome,
        cognome: pair.paziente.cognome,
      },
    };

    await prisma.pagamento.create({
      data: {
        id_Utente: admin.id,
        id_Pagante: pair.pagante.id,
        id_Paziente: pair.paziente.id,
        n_fattura: n,
        anno: 2026,
        data,
        prezzo_totale: new Prisma.Decimal(prezzo),
        bollo,
        bolloCodice,
        mod_pag: modPag,
        pagamento_tracciato: tracciato,
        sedute: (n % 4) + 1,
        commento: `Terapia riabilitativa logopedia seduta n. ${n}`,
        natura_iva: naturaIva,
        flag_opposizione: flagOpposizione,
        stato_ts: statoTs,
        protocollo_ts: protocolloTs,
        data_invio_ts: dataInvioTs,
        trasmissioniTs: trasmissioneId ? { connect: [{ id: trasmissioneId }] } : undefined,
        citta: pair.pagante.citta,
        cap: pair.pagante.cap,
        snapshotAnagrafica,
        mesi: {
          create: [{ mese: meseNome, prezzo: new Prisma.Decimal(prezzo) }],
        },
      },
    });

    globalCount++;
  }
  console.log(`   70 fatture create per l'anno 2026.`);

  console.log(`\n=== COMPLETATO CON SUCCESSO: ${globalCount} FATTURE INSERITE ===`);
  console.log("Riepilogo dati pronti per collaudo UI:");
  console.log("- Anno 2025: 35 fatture storiche (paginazione, ricerca, archivio)");
  console.log("- Anno 2026: 70 fatture attuali con tutti gli stati TS:");
  console.log("  • ~47 DA_INVIARE (perfette per selezione massiva, test pulsante, filtri)");
  console.log("  • 15 INVIATA (con protocolli e ricevuta)");
  console.log("  • 5 IN_TRASMISSIONE (con lock e sblocco)");
  console.log("  • 2 DA_CANCELLARE_SU_TS");
  console.log("  • 1 ANNULLATA_TS");
  console.log("  • Alcune fatture con bollo mancante, contanti e opposizione privacy");
  console.log("  • 1 pagante con CF errato per testare gli alert rossi di convalida");
}

seedUi()
  .catch((err) => {
    console.error("Errore durante il seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
