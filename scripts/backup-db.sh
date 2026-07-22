#!/bin/sh
# Esegue pg_dump periodici verso /backups, con retention configurabile.
# Pensato per girare come entrypoint del container "backup" in docker-compose.prod.yml.
set -eu
umask 077

: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[backup] errore: BACKUP_ENCRYPTION_KEY non impostata" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

mkdir -p "$BACKUP_DIR"

while true; do
  timestamp=$(date +%Y%m%d-%H%M%S)
  filename="$BACKUP_DIR/${POSTGRES_DB}-${timestamp}.sql.gz.gpg"

  echo "[backup] $(date -Iseconds) avvio dump verso $filename"
  if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip | gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" -o "$filename"; then
    echo "[backup] $(date -Iseconds) completato"
  else
    echo "[backup] $(date -Iseconds) FALLITO" >&2
    rm -f "$filename"
  fi

  find /backups -type f -name "*.gpg" -mtime +14 -exec rm {} \;

  sleep "$BACKUP_INTERVAL_SECONDS"
done
