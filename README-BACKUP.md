# Backup del database — ripristino

I backup prodotti dal servizio `backup` in `docker-compose.prod.yml` sono dump `pg_dump` compressi con `gzip` e cifrati con GPG (AES256, simmetrico), salvati in `./backups` con nome `<database>-<timestamp>.sql.gz.gpg`. La chiave di cifratura è la variabile d'ambiente `BACKUP_ENCRYPTION_KEY` (definita in `.env.prod`). I file più vecchi di `BACKUP_RETENTION_DAYS` giorni (variabile d'ambiente, default 14 se non impostata — vedi `.env.prod.example`) vengono rimossi automaticamente dallo script.

**Conserva `BACKUP_ENCRYPTION_KEY` anche altrove, non solo in `.env.prod`** (un password manager, non un altro file sullo stesso host): chi accede alla macchina dove gira `.env.prod` ha già sia le copie cifrate sia la chiave per decifrarle; chi perde la macchina perde entrambi.

## Verifica automatica del ripristino

Ad ogni backup, `scripts/backup-db.sh` decifra e ripristina automaticamente il dump appena creato in un database usa-e-getta (`<database>_backup_verify`) sullo stesso server Postgres, poi lo elimina. Questo prova che il backup sia davvero utilizzabile (passphrase corretta, dump non troncato) **ad ogni esecuzione**, non solo una volta l'anno come minimo accettabile. L'esito ("verifica ripristino OK" o "VERIFICA FALLITA", con il dettaglio dell'errore) finisce nei log del container `backup` (`docker compose -f docker-compose.prod.yml logs backup`). Una verifica fallita non cancella il backup (resta comunque salvato per un'ispezione manuale) e non ferma il ciclo successivo.

## Copia off-site (opzionale)

Il container di backup include `rclone`. Impostando `RCLONE_REMOTE` in `.env.prod` (formato `remote:percorso`, es. `gdrive:gestionale-backups`), ogni backup cifrato viene copiato anche sulla destinazione remota configurata — subito dopo la verifica di ripristino, indipendentemente dal suo esito. Senza `RCLONE_REMOTE` impostata, questo passaggio viene saltato: il backup continua a funzionare solo con la copia locale in `./backups`.

Per configurare Google Drive (o un altro provider supportato da rclone — S3, Backblaze B2, un NAS via SFTP/WebDAV, ecc.): vedi le istruzioni in `rclone.conf.example`. In breve: copia `rclone.conf.example` in `rclone.conf`, esegui `rclone config` per generare le credenziali del remote scelto, imposta `RCLONE_REMOTE` di conseguenza, poi `docker compose -f docker-compose.prod.yml up -d --build backup`.

**Nota:** rclone copia solo il file `.gpg` già cifrato — non vede mai la passphrase né il contenuto in chiaro del dump.

## Notifica di esito (opzionale)

Sia il backup sia la retention dell'audit log riportano l'esito solo nei log del container (`docker compose -f docker-compose.prod.yml logs backup` / `logs audit-log-retention`) — nessuno li apre di routine, quindi un fallimento persistente (credenziali cambiate, disco pieno, passphrase errata) può passare inosservato per settimane. Impostando `BACKUP_HEALTHCHECK_PING_URL` / `AUDIT_LOG_RETENTION_HEALTHCHECK_PING_URL` in `.env.prod` con l'URL di un "check" su un servizio di monitoraggio "dead man's switch" (consigliato: [Healthchecks.io](https://healthchecks.io), che ha un piano gratuito), ogni esecuzione invia un ping GET a quell'URL — sull'URL base in caso di successo, con `/fail` in coda in caso di fallimento (convenzione Healthchecks.io, ma compatibile con qualunque webhook che ignori un suffisso extra sull'URL).

Il vantaggio di questo modello rispetto a un semplice allarme sull'errore: copre anche il caso peggiore, quello in cui il container **non è più partito affatto** (quindi non c'è nessun errore da segnalare) — Healthchecks.io allarma se il ping atteso non arriva entro l'intervallo configurato sul check.

Senza queste variabili impostate, il comportamento è invariato: nessun ping, nessuna dipendenza esterna.

## Procedura di ripristino

1. Decifrare e decomprimere il backup:

   ```sh
   gpg --decrypt --batch --passphrase "YOUR_KEY_HERE" filename.sql.gz.gpg | zcat > restore.sql
   ```

   Sostituire `YOUR_KEY_HERE` con il valore di `BACKUP_ENCRYPTION_KEY` usato al momento del backup e `filename.sql.gz.gpg` con il file da ripristinare.

2. Ripristinare il dump nel container del database:

   ```sh
   docker exec -i <container_name> psql -U <username> <database> < restore.sql
   ```

   Sostituire `<container_name>` (es. `gestionale-db`), `<username>` e `<database>` con i valori usati in `.env.prod`.
