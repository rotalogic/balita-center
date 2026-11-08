#!/usr/bin/env bash
# Backup database Balita Center (pg_dump format custom) + rotasi.
#
# Cara pakai di VPS (jadwalkan lewat cron, lihat PANDUAN-DEPLOY.md):
#   /opt/balita-center/deploy/backup-db.sh
# Konfigurasi dibaca dari /etc/balita-center/job.env (DATABASE_URL),
# atau dari environment. Penimpaan opsional:
#   BACKUP_DIR  folder tujuan (bawaan: /var/backups/balita-center)
#   BACKUP_KEEP jumlah berkas yang dipertahankan (bawaan: 14)
#
# Memulihkan:  pg_restore --clean --if-exists -d "$DATABASE_URL" berkas.dump
# (UJI pulih di database kosong terpisah sebelum memulihkan produksi.)
set -euo pipefail

ENV_FILE="${BALITA_ENV_FILE:-/etc/balita-center/job.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL belum diatur (di $ENV_FILE atau environment)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/balita-center}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/balita-center-$STAMP.dump"
TMP="$OUT.tmp"

pg_dump --format=custom --no-owner --file="$TMP" "$DATABASE_URL"
mv "$TMP" "$OUT"

# Rotasi: pertahankan BACKUP_KEEP berkas terbaru.
ls -1t "$BACKUP_DIR"/balita-center-*.dump 2>/dev/null | tail -n "+$((BACKUP_KEEP + 1))" | while read -r lama; do
  rm -f "$lama"
done

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] $OUT ($SIZE) — tersimpan; retensi $BACKUP_KEEP berkas di $BACKUP_DIR"
