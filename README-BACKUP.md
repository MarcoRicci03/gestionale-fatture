# Backup del database — ripristino

I backup prodotti dal servizio `backup` in `docker-compose.prod.yml` sono dump `pg_dump` compressi con `gzip` e cifrati con GPG (AES256, simmetrico), salvati in `./backups` con nome `<database>-<timestamp>.sql.gz.gpg`. La chiave di cifratura è la variabile d'ambiente `BACKUP_ENCRYPTION_KEY` (definita in `.env.prod`). I file più vecchi di `BACKUP_RETENTION_DAYS` giorni (variabile d'ambiente, default 14 se non impostata — vedi `.env.prod.example`) vengono rimossi automaticamente dallo script.

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
