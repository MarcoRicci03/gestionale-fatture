# Piano — Creazione utenti con password temporanea

**Data:** 2026-07-26
**Branch di partenza:** master (`615f7b7`)
**Copre anche:** DEP-01 della roadmap (creazione del primissimo admin)

---

## Obiettivo

Solo un admin può creare nuovi utenti. Sceglie lo username e imposta una password che è **temporanea per convenzione**: un bottone la genera casualmente e sicura, un secondo bottone la copia negli appunti per comunicarla all'utente. L'utente che accede con una password impostata da un admin vede un **avviso non bloccante** finché non la cambia dal proprio account.

Lo stesso trattamento vale per il reset password che l'admin esegue su un utente esistente: è lo stesso scenario (l'utente riceve una credenziale che non ha scelto).

## Decisioni prese

| Punto | Scelta |
|---|---|
| Cambio password al primo accesso | **Avviso**, non blocco. Nessun redirect forzato: banner nel layout protetto con link a `/account`, che sparisce da solo al cambio password. |
| Consegna della password all'admin | Campo **in chiaro** nel form, con bottone ↻ Genera e bottone ⧉ Copia accanto. |
| Reset password admin | **Stesso componente** del form di creazione: genera, copia, e rimette il flag a `true`. |
| Primo admin (DEP-01) | **Incluso**: script di seed idempotente, eseguibile anche dentro l'immagine di produzione. |

## Cosa esiste già (nessuna modifica necessaria)

- `createUser` e `resetUserPassword` in `lib/actions/users.ts` sono già `requireAdmin()`, già validate con Zod, già auditate (`USER_CREATE`, `USER_PASSWORD_RESET`) e già rate-limitate sul reset (20/ora per admin).
- `resetUserPassword` incrementa già `tokenVersion`, quindi revoca tutte le sessioni aperte dell'utente target.
- `passwordSchema` (`lib/validations/user.ts`) impone già ≥12 caratteri e una deny-list di password comuni.
- `hashPassword` usa già bcrypt cost 12.
- L'admin non può già modificare/resettare/disabilitare sé stesso.

Il lavoro è quindi tutto additivo: nessuna logica di sicurezza esistente viene toccata.

---

## Architettura

Cinque unità nuove, ognuna con una responsabilità sola e testabile da sé:

| Unità | File | Responsabilità | Dipende da |
|---|---|---|---|
| Generatore | `lib/auth/generate-password.ts` | Produrre una stringa casuale sicura e leggibile | `crypto.getRandomValues` |
| Stato "temporanea" | `Utente.mustChangePassword` + migration | Ricordare che la password è stata impostata da un admin | — |
| Campo UI | `components/users/temporary-password-field.tsx` | Input in chiaro + genera + copia | Generatore |
| Avviso | `components/account/temporary-password-notice.tsx` | Segnalare all'utente che deve cambiarla | `Session` |
| Bootstrap | `prisma/seed.mjs` | Creare il primo admin su un DB vuoto | `@prisma/client`, `bcryptjs` |

Flusso dello stato:

```
createUser         ──→ mustChangePassword = true
resetUserPassword  ──→ mustChangePassword = true   (+ tokenVersion++, già presente)
seed (primo admin) ──→ mustChangePassword = true
changePassword     ──→ mustChangePassword = false  (+ tokenVersion++, già presente)
```

`updateProfile` e `updateUser` non toccano il flag.

---

# Task 1 — Generatore di password

**File nuovo:** `lib/auth/generate-password.ts`
**File nuovo:** `lib/auth/generate-password.test.ts`

## Requisiti

1. **Sicuro**: `crypto.getRandomValues`, mai `Math.random()`. Disponibile sia nel browser sia in Node 20 sia in jsdom (usato da Vitest), quindi la stessa funzione è testabile e utilizzabile dal client component senza adattatori.
2. **Senza bias**: la selezione dei caratteri usa *rejection sampling*. Un banale `byte % alfabeto.length` favorisce i primi caratteri dell'alfabeto quando `256` non è multiplo della lunghezza — difetto reale, benché piccolo, e gratuito da evitare.
3. **Leggibile**: l'admin deve poterla dettare al telefono o riscriverla a mano. Alfabeto **senza caratteri ambigui** (`0`/`O`, `1`/`l`/`I`/`i`) e raggruppamento in blocchi di 4 separati da `-`.
4. **Conforme alla policy esistente**: deve sempre superare `passwordSchema`. Non lo si assume: lo si verifica con un test.

## Implementazione

```ts
// Alfabeto senza caratteri visivamente ambigui: la password temporanea viene
// letta, dettata o riscritta a mano dall'admin, quindi 0/O e 1/l/I/i sono
// esclusi. 55 simboli × 16 caratteri ≈ 92 bit di entropia, ampiamente sopra
// qualunque soglia sensata per una credenziale a vita breve.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_SIZE = 4;
const GROUP_COUNT = 4;
```

- `randomChar()`: legge un byte da `crypto.getRandomValues(new Uint8Array(1))`; se il byte è ≥ `Math.floor(256 / ALPHABET.length) * ALPHABET.length` lo **scarta e ripete** (questo è il rejection sampling), altrimenti ritorna `ALPHABET[byte % ALPHABET.length]`.
- `generateTemporaryPassword()`: costruisce `GROUP_COUNT` gruppi da `GROUP_SIZE` caratteri e li unisce con `-`.

Risultato: 19 caratteri, es. `k7Qm-4xPv-92Lz-Rw2p`. Ben oltre il minimo di 12, e i trattini non violano nessun vincolo (`passwordSchema` non impone un charset).

## Test — `lib/auth/generate-password.test.ts`

| Caso | Asserzione |
|---|---|
| Conformità alla policy | Su 200 generazioni, **ognuna** supera `passwordSchema.safeParse()`. È il test che protegge da una futura stretta della policy: se un domani si aggiungesse un requisito di simboli, questo test fallirebbe subito invece di lasciare un generatore che produce password rifiutate dal form. |
| Formato | Corrisponde a `/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/`. |
| Alfabeto | Nessuna generazione contiene `0`, `O`, `1`, `l`, `I`, `i`. |
| Unicità | 200 generazioni producono 200 valori distinti (smoke test contro un generatore rotto che restituisce sempre lo stesso valore). |
| Distribuzione | Su un campione ampio compaiono caratteri da tutte e tre le classi (minuscole, maiuscole, cifre) — non un requisito della singola password, ma un controllo che l'alfabeto sia davvero usato per intero. |

---

# Task 2 — Campo `mustChangePassword`

## 2.1 Schema e migration

**File:** `prisma/schema.prisma`, model `Utente`, subito dopo `tokenVersion`:

```prisma
  // Impostato a true quando la password è stata scelta da un admin
  // (createUser, resetUserPassword, seed del primo admin): è una credenziale
  // temporanea che l'utente non ha scelto e che dovrebbe sostituire.
  // changePassword (lib/actions/account.ts) lo riporta a false. Non blocca
  // l'accesso: alimenta solo l'avviso nel layout protetto.
  mustChangePassword Boolean @default(false)
```

`@default(false)`, non `true`: la migration non deve far comparire l'avviso a utenti già esistenti che hanno scelto la propria password.

```sh
npx prisma migrate dev --name add_must_change_password
```

Verificare che la migration generata sia un semplice `ALTER TABLE "utenti" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;` e nient'altro — in particolare **che non tocchi gli indici unique parziali su `paganti`**, che Prisma non introspette (vedi il commento sul model `Pagante` in `schema.prisma`). Se la migration generata li droppa o li ricrea, va corretta a mano.

## 2.2 Esposizione nella sessione

**File:** `lib/auth/session.ts`

Aggiungere `"mustChangePassword"` al `Pick<Utente, ...>` del tipo `Session` (riga 9-18) e il campo corrispondente all'oggetto restituito da `getSession` (righe 53-61).

`getSession` fa già `findUnique` senza `select`, quindi il dato è già in memoria: costo zero. Il flag diventa così disponibile ovunque arrivi `session`, incluso `app/(protected)/layout.tsx` che lo passa già a `Sidebar` e `MobileHeader`.

## 2.3 Scrittura del flag

| File | Funzione | Modifica |
|---|---|---|
| `lib/actions/users.ts` | `createUser` (riga ~48) | aggiungere `mustChangePassword: true` al `data` del `create` |
| `lib/actions/users.ts` | `resetUserPassword` (riga ~158) | aggiungere `mustChangePassword: true` al `data` dell'`update` |
| `lib/actions/account.ts` | `changePassword` (riga ~62) | aggiungere `mustChangePassword: false` al `data` dell'`update` |

In `changePassword` il campo va nello **stesso `update`** che aggiorna `passwordHash` e incrementa `tokenVersion`: una sola query, nessuna finestra in cui l'hash è nuovo ma il flag è ancora `true`.

Nessuna nuova voce in `AUDIT_ACTIONS`: `USER_CREATE`, `USER_PASSWORD_RESET` e `ACCOUNT_PASSWORD_CHANGE` descrivono già l'evento. **Non** aggiungere la password al `meta` di nessun log (cfr. il monito in testa a `lib/audit/log.ts`).

## 2.4 Visibilità per l'admin (opzionale ma consigliato)

Aggiungere `mustChangePassword: true` a `SAFE_USER_SELECT` (`lib/data/user-select.ts`) e mostrare un badge "Password temporanea" nella colonna Stato di `components/users/users-manager.tsx` (tabella riga ~89 e card riga ~152).

Costa poco e risolve un problema pratico: l'admin che ha creato cinque utenti la settimana scorsa vede a colpo d'occhio chi non ha ancora fatto il primo accesso. Il campo è un booleano non sensibile, quindi la whitelist di `SAFE_USER_SELECT` resta rispettata (`verify-safe-user-select.test.ts` continua a passare: verifica l'**assenza** di `passwordHash`, non un elenco chiuso).

---

# Task 3 — Campo password condiviso

**File nuovo:** `components/users/temporary-password-field.tsx`

## Interfaccia

Componente controllato, agnostico rispetto a react-hook-form, così i due form lo cablano come preferiscono:

```ts
type TemporaryPasswordFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  label?: string;        // "Password" | "Nuova password"
  autoGenerate?: boolean; // genera un valore iniziale al mount
};
```

## Comportamento

```
Password
┌────────────────────────────┐ ┌───┐ ┌───┐
│ k7Qm-4xPv-92Lz-Rw2p        │ │ ↻ │ │ ⧉ │
└────────────────────────────┘ └───┘ └───┘
Password temporanea: l'utente vedrà un avviso finché non la cambia.
```

- **Input `type="text"`**: l'admin sta *impostando* la credenziale, non inserendo la propria, e deve poterla verificare prima di confermare. Resta modificabile a mano (l'admin può scriverne una sua invece di generarla).
- **↻ Genera**: chiama `generateTemporaryPassword()` e propaga il valore. Ripetibile: se all'admin il risultato non piace, rigenera. `aria-label="Genera password casuale"`.
- **⧉ Copia**: scrive il valore negli appunti e passa per ~2 secondi a uno stato "Copiato" (icona check + testo), poi torna normale. Disabilitato quando il campo è vuoto. `aria-label="Copia password negli appunti"`.
- **Testo di supporto** sotto al campo, che spiega cosa succederà all'utente.
- **`autoGenerate`**: attivo nel form di creazione (l'admin trova già una password pronta), spento nel reset (gesto più deliberato — l'admin deve premere ↻ apposta).

## Attenzione: la clipboard non funziona in HTTP semplice

`navigator.clipboard` è disponibile **solo in secure context** (HTTPS o `localhost`). Questo progetto oggi non ha TLS (DEP-03 della roadmap) e `next.config.ts` contempla esplicitamente un accesso via IP di LAN (`allowedDevOrigins: ['192.168.0.56']`): in quello scenario `navigator.clipboard` è `undefined` e il bottone fallirebbe **in silenzio**, che è il peggior esito possibile per un bottone il cui unico scopo è non far perdere la password.

Gestione a tre livelli:

```ts
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* cade sotto */ }
  }
  // Fallback per contesti non sicuri (accesso via IP di LAN in HTTP):
  // textarea temporanea + execCommand. Deprecato ma ancora supportato
  // ovunque, ed è l'unica strada senza secure context.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}
```

Se anche il fallback fallisce, mostrare un messaggio esplicito ("Copia non riuscita: seleziona e copia manualmente") invece di non dare alcun segnale. Il campo è comunque in chiaro, quindi l'admin ha sempre una via d'uscita.

## Cablaggio nei due form

### `components/users/user-form.tsx`

Il file oggi passa `register` ed `errors` a `UserFields` tipizzati `any`, con due `eslint-disable` (QUA-02 della roadmap). Il campo password è già condizionale (`showPassword`), quindi **estrarlo** da `UserFields` e renderizzarlo direttamente in `UserCreateForm` — dove i tipi di `useForm<UserCreateFormData>` sono corretti — risolve due cose insieme:

- rimuove la prop `showPassword` e il ramo condizionale da `UserFields`, che torna a essere il solo insieme di campi comuni a creazione e modifica;
- elimina uno dei due usi di `any` senza toccare il resto.

In `UserCreateForm`:

```tsx
const password = useWatch({ control, name: "password" });
// ...
<TemporaryPasswordField
  value={password ?? ""}
  onValueChange={(v) => setValue("password", v, { shouldValidate: true })}
  error={errors.password?.message}
  autoGenerate
/>
```

`shouldValidate: true` è necessario perché il valore arriva da `setValue` e non da un evento di input: senza, l'errore di validazione precedente resterebbe visibile dopo una generazione valida.

### `components/users/reset-password-form.tsx`

Sostituire l'`<Input type="password">` (righe 45-49) con lo stesso componente, `autoGenerate` assente. Nessun'altra modifica: la Server Action e lo schema restano identici.

---

# Task 4 — Avviso di password temporanea

**File nuovo:** `components/account/temporary-password-notice.tsx`
**File modificato:** `app/(protected)/layout.tsx`

## Componente

Server component (nessuno stato), banner ambra coerente con l'avviso marca da bollo già presente in `invoices-manager.tsx` (`text-amber-600` + icona `AlertTriangle` di lucide):

```
⚠  Stai usando una password temporanea impostata da un amministratore.
   Cambiala dal tuo account. →
```

Con `<Link href="/account">` sulla call to action. `role="status"`, non `role="alert"`: è informativo, non urgente.

## Inserimento

In `app/(protected)/layout.tsx`, dentro `<main>` e sopra `{children}`, così eredita il padding esistente:

```tsx
<main className="flex-1 p-6 lg:p-8">
  {session.mustChangePassword && <TemporaryPasswordNotice />}
  {children}
</main>
```

## Perché lì e non altrove

- **Nel layout protetto**, non nelle singole pagine: la sessione è già disponibile lì (riga 10) e il banner compare su ogni pagina senza toccarne nessuna.
- **Anche su `/account`**: sembra ridondante, ma è proprio la pagina dove l'azione va compiuta — il banner e il form "Sicurezza" convivono senza fastidio.
- **Non dismissibile**: un banner che si può chiudere viene chiuso e dimenticato, e questo avviso ha già una condizione di uscita naturale — sparisce da solo nell'istante in cui la password viene cambiata, perché `changePassword` azzera il flag e riemette il cookie di sessione. Aggiungere un "non mostrare più" significherebbe salvare uno stato per non ricordare all'utente una cosa che deve fare.
- **Nessun redirect forzato**: scelta esplicita. Un blocco su `mustChangePassword` andrebbe implementato in `proxy.ts` o nel layout con estrema cautela, perché un errore lì blocca fuori tutti gli utenti, admin compreso — esattamente lo scenario senza vie d'uscita descritto in SEC-05 della roadmap.

---

# Task 5 — Seed del primo admin (DEP-01)

**File nuovo:** `prisma/seed.mjs`
**File modificato:** `package.json` (uno script), `.env.prod.example` (due variabili documentate), `README.md`

## Il vincolo che detta la forma

Lo script deve poter girare **dentro l'immagine di produzione**, dove `Dockerfile:26` (`npm prune --omit=dev`) ha già rimosso ogni devDependency: niente `tsx`, niente CLI `prisma`, niente `dotenv`. Quindi **non** può essere un `prisma/seed.ts` invocato da `prisma db seed`, che è la strada consueta ma qui non funzionerebbe.

Soluzione: **ESM puro (`.mjs`)** che importa solo `@prisma/client` e `bcryptjs` — entrambe dipendenze di produzione, entrambe presenti nell'immagine. Nessuna dipendenza nuova, nessuna modifica al Dockerfile, e resta indipendente da DEP-02 (che riguarda la CLI Prisma per le migration).

## Comportamento

1. Legge `SEED_ADMIN_USERNAME` e `SEED_ADMIN_PASSWORD` dall'ambiente. Se mancano: messaggio esplicativo su stderr ed `exit(1)`.
2. **Idempotente**: `prisma.utente.count({ where: { isAdmin: true } })`. Se è > 0, stampa "un amministratore esiste già, nessuna azione" ed `exit(0)`. Rieseguirlo per sbaglio non fa danni e non sovrascrive niente.
3. **Applica la policy**: rifiuta una password sotto la lunghezza minima. Il valore non può essere importato da `lib/validations/user.ts` (è TypeScript, e qui gira Node puro), quindi la costante è duplicata con un commento che indica la fonte di verità — e un test la tiene allineata (vedi sotto).
4. Crea l'utente con `isAdmin: true`, `abilitato: true`, `mustChangePassword: true` e l'hash prodotto da `bcrypt.hash(password, 12)` — **stesso cost factor** di `hashPassword`, altrimenti il login del primo admin avrebbe un tempo di verifica diverso da tutti gli altri.
5. Stampa lo username creato e il promemoria di cambiare la password. **Non stampa mai la password**: è già nota a chi lancia il comando, e finirebbe nei log del container.
6. `await prisma.$disconnect()` in un `finally`.

## Esecuzione

```jsonc
// package.json → scripts
"seed": "node --env-file=.env prisma/seed.mjs"
```

`--env-file` è nativo in Node 20+ (presente sia in locale sia in `node:20-alpine`): niente `dotenv`.

| Ambiente | Comando |
|---|---|
| Sviluppo | `SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='...' npm run seed` |
| Produzione | `docker compose -f docker-compose.prod.yml exec app node prisma/seed.mjs` (le variabili arrivano da `.env.prod` tramite `env_file`) |

## Variabili in `.env.prod.example`

```sh
# --- Bootstrap del primo amministratore ---
# Usate SOLO da `node prisma/seed.mjs`, eseguito una volta a database vuoto.
# Lo script non fa nulla se esiste già un amministratore.
# La password deve rispettare la policy dell'app (min 12 caratteri, vedi
# lib/validations/user.ts) ed è temporanea: al primo accesso l'app segnala
# di cambiarla. Dopo il primo avvio queste due righe possono essere rimosse.
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=change-me-min-12-caratteri
```

## Nota su `README.md`

Il README è oggi il boilerplate di `create-next-app` (DOC-01). Non serve riscriverlo tutto qui, ma **questo passo va documentato**: senza, la funzionalità progettata in questo piano è irraggiungibile al primo deploy. Minimo indispensabile: una sezione "Primo avvio" con migrazioni → seed → login → cambio password.

---

# Task 6 — Test

Seguendo l'idioma del progetto: logica pura in test unitari accanto al modulo, invarianti strutturali in `scripts/verify-*.test.ts`.

| File | Tipo | Verifica |
|---|---|---|
| `lib/auth/generate-password.test.ts` | unitario | Vedi Task 1 — conformità a `passwordSchema`, formato, alfabeto, unicità |
| `scripts/verify-temporary-password-flow.test.ts` | statico | Analizza il sorgente di `lib/actions/users.ts` e `lib/actions/account.ts`: `createUser` e `resetUserPassword` **devono** contenere `mustChangePassword: true`; `changePassword` **deve** contenere `mustChangePassword: false`. Stesso approccio di `verify-actions-auth.test.ts` e `verify-audit-log-coverage.test.ts`: protegge un'invariante che il type system non può esprimere — dimenticare il flag in una nuova action compila benissimo e rompe la funzionalità in silenzio. |
| `scripts/verify-seed-password-policy.test.ts` | statico | La costante di lunghezza minima duplicata in `prisma/seed.mjs` coincide con quella di `passwordSchema`. Impedisce che un domani si alzi il minimo a 14 in `lib/validations/user.ts` lasciando il seed a 12. |
| `components/users/temporary-password-field.test.tsx` | componente | Con Testing Library, sul modello di `login-form.test.tsx`: il click su ↻ riempie il campo con un valore conforme; il click su ⧉ chiama la clipboard e mostra lo stato "Copiato"; ⧉ è disabilitato a campo vuoto. La clipboard va mockata (`navigator.clipboard.writeText` in jsdom non è implementata). |

**Da verificare che continuino a passare** (nessuna modifica attesa): `verify-safe-user-select.test.ts` (il nuovo campo è non sensibile), `verify-actions-auth.test.ts` (nessuna action nuova), `verify-audit-log-coverage.test.ts` (nessuna mutazione nuova), `verify-password-policy.test.ts`, `verify-session-token-version.test.ts`.

---

# Ordine di esecuzione

Ogni passo lascia il repository in uno stato compilabile e con i test verdi.

| # | Passo | Perché in questa posizione |
|---|---|---|
| 1 | Task 1 — generatore + test | Indipendente da tutto. Si può fare e verificare da solo. |
| 2 | Task 2.1/2.2 — migration + `Session` | Base di stato. Dopo questo passo `npx tsc --noEmit` e `npm test` devono essere ancora verdi, senza cambi di comportamento. |
| 3 | Task 2.3 — scrittura del flag nelle tre action | Il flag inizia a popolarsi. Ancora nessun effetto visibile. |
| 4 | Task 3 — campo condiviso + cablaggio nei due form | Prima parte visibile: genera e copia funzionano. |
| 5 | Task 4 — banner | Chiude il ciclo: ora il flag ha un effetto per l'utente finale. |
| 6 | Task 2.4 — badge nella lista utenti | Rifinitura, isolata e facoltativa. |
| 7 | Task 5 — seed | Indipendente dai precedenti, ma va dopo la migration del passo 2 perché imposta `mustChangePassword`. |
| 8 | Task 6 — test mancanti | Quelli di ogni task vanno scritti col task; qui si completano i due `verify-*` trasversali. |

## Verifica finale

```sh
npx tsc --noEmit          # atteso: 0 errori
npm run lint              # atteso: 0 errori, 2 warning preesistenti (QUA-01)
npm test                  # atteso: 233 test preesistenti + ~15 nuovi, tutti verdi
```

Prova manuale end-to-end:

1. `npm run seed` su un DB vuoto → crea l'admin; rilanciarlo → non fa nulla.
2. Login come admin → il banner ambra compare (il seed imposta il flag).
3. `/account` → cambio password → il banner sparisce al reload.
4. `/users` → Nuovo utente → il campo password è già compilato; ↻ rigenera, ⧉ copia.
5. Logout, login col nuovo utente → banner presente.
6. Come admin, reset password su quell'utente → l'utente viene disconnesso (`tokenVersion`) e al nuovo login rivede il banner.

---

# Fuori scope (deliberatamente)

| Cosa | Perché no |
|---|---|
| Redirect forzato al cambio password | Scelta esplicita: avviso, non blocco. Un gate mal fatto blocca fuori anche l'admin, senza recupero applicativo (cfr. SEC-05). |
| Scadenza temporale della password temporanea | Richiederebbe un timestamp, un job e una politica di cosa succede alla scadenza. Nessuna esigenza reale su un gestionale mono-studio. |
| Invio della password via email | Nessuna infrastruttura email nel progetto, e la consegna a voce/di persona è più sicura del canale email in chiaro. |
| Link di attivazione monouso | Molto più robusto della password condivisa, ma richiede token, scadenza, tabella dedicata e route pubblica. Sproporzionato per il numero di utenti in gioco. |
| `.max()` su `nome`/`cognome` in `userCreateSchema` | È LOG-06 della roadmap: fix di una riga, ma è un rilievo a sé e non va nascosto dentro questo lavoro. |
