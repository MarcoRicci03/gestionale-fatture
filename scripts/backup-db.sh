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
: "${RCLONE_CONFIG_PATH:=/rclone.conf}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[backup] errore: BACKUP_ENCRYPTION_KEY non impostata" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

mkdir -p "$BACKUP_DIR"

# Prova di ripristino automatica (DEP-06): decifra, decomprime e ripristina
# il dump appena creato in un database usa-e-getta sullo stesso server
# Postgres, poi lo elimina. Prova che il backup sia davvero utilizzabile
# (passphrase corretta, dump non troncato) ad ogni esecuzione, non solo una
# volta l'anno come minimo accettabile. Il file decifrato va SOLO in /tmp
# (nel filesystem effimero del container, mai nel bind mount ./backups
# condiviso con l'host): un dump in chiaro non deve toccare il disco
# dell'host nemmeno per pochi secondi.
verify_backup() {
  encrypted="$1"
  verify_db="${POSTGRES_DB}_backup_verify"
  compressed="/tmp/.verify-$$.sql.gz"
  plain="/tmp/.verify-$$.sql"

  if ! gpg --decrypt --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" -o "$compressed" "$encrypted" 2>/tmp/.verify-$$.log; then
    echo "[backup] $(date -Iseconds) VERIFICA FALLITA: impossibile decifrare $encrypted" >&2
    cat /tmp/.verify-$$.log >&2
    rm -f "$compressed" /tmp/.verify-$$.log
    return 1
  fi

  if ! gunzip -c "$compressed" > "$plain" 2>/tmp/.verify-$$.log; then
    echo "[backup] $(date -Iseconds) VERIFICA FALLITA: il dump decifrato non è un gzip valido ($encrypted)" >&2
    cat /tmp/.verify-$$.log >&2
    rm -f "$compressed" "$plain" /tmp/.verify-$$.log
    return 1
  fi
  rm -f "$compressed"

  dropdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" --if-exists "$verify_db" 2>/dev/null || true

  ok=0
  if ! createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$verify_db" 2>/tmp/.verify-$$.log; then
    echo "[backup] $(date -Iseconds) VERIFICA FALLITA: impossibile creare il database di verifica $verify_db" >&2
    cat /tmp/.verify-$$.log >&2
    ok=1
  elif psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$verify_db" -v ON_ERROR_STOP=1 -q -f "$plain" >/tmp/.verify-$$.log 2>&1; then
    echo "[backup] $(date -Iseconds) verifica ripristino OK ($encrypted)"
  else
    echo "[backup] $(date -Iseconds) VERIFICA FALLITA: il ripristino di $encrypted ha prodotto errori" >&2
    cat /tmp/.verify-$$.log >&2
    ok=1
  fi

  rm -f "$plain" /tmp/.verify-$$.log
  dropdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" --if-exists "$verify_db" 2>/dev/null || true
  return $ok
}

# Copia off-site opzionale (DEP-06): senza RCLONE_REMOTE configurata, non fa
# nulla — chi non ha ancora scelto/configurato una destinazione remota non
# vede rotto il resto del backup. Il file cifrato (mai quello in chiaro)
# viene copiato così com'è: rclone non vede mai la passphrase né il
# contenuto in chiaro.
sync_offsite() {
  encrypted="$1"

  if [ -z "${RCLONE_REMOTE:-}" ]; then
    return 0
  fi

  if rclone copy "$encrypted" "$RCLONE_REMOTE" --config "$RCLONE_CONFIG_PATH"; then
    echo "[backup] $(date -Iseconds) copiato off-site su $RCLONE_REMOTE"
  else
    echo "[backup] $(date -Iseconds) SYNC OFF-SITE FALLITA per $encrypted (verso $RCLONE_REMOTE)" >&2
  fi
}

while true; do
  timestamp=$(date +%Y%m%d-%H%M%S)
  filename="$BACKUP_DIR/${POSTGRES_DB}-${timestamp}.sql.gz.gpg"

  echo "[backup] $(date -Iseconds) avvio dump verso $filename"
  if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip | gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" -o "$filename"; then
    echo "[backup] $(date -Iseconds) completato"
    verify_backup "$filename" || true
    sync_offsite "$filename"
  else
    echo "[backup] $(date -Iseconds) FALLITO" >&2
    rm -f "$filename"
  fi

  find "$BACKUP_DIR" -type f -name "*.gpg" -mtime +"$BACKUP_RETENTION_DAYS" -exec rm {} \;

  sleep "$BACKUP_INTERVAL_SECONDS"
done
