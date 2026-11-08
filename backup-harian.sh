#!/usr/bin/env bash
# Backup harian Balita Center: dump PostgreSQL + arsip source + konfigurasi.
# Simpan 14 hari terakhir. Aman dijalankan berulang.
set -euo pipefail

TUJUAN="/home/ubuntu/backup-balita"
SIMPAN_HARI=14
STAMP="$(date +%Y%m%d-%H%M%S)"
DIR="$TUJUAN/$STAMP"

mkdir -p "$DIR"

# 1) Database (format custom, bisa dipulihkan selektif)
sudo docker exec -u postgres balita-db pg_dump -Fc balita_center > "$DIR/balita_center.dump"

# 2) Verifikasi dump benar-benar bisa dibaca (jangan simpan backup rusak)
JUMLAH=$(sudo docker run --rm -v "$DIR":/b postgres:16 sh -c "pg_restore -l /b/balita_center.dump | grep -c 'TABLE DATA'" || echo 0)
if [ "${JUMLAH:-0}" -lt 10 ]; then
  echo "GAGAL: dump hanya berisi $JUMLAH tabel" >&2
  exit 1
fi

# 3) Source tanpa node_modules/.next
tar --exclude=node_modules --exclude=.next --exclude=.git -czf "$DIR/src.tar.gz" -C /opt balita-center

# 4) Konfigurasi infra
cp /etc/nginx/conf.d/balita-domain.conf "$DIR/nginx-balita.conf" 2>/dev/null || true
cp /opt/balita-center/CREDENTIALS.txt "$DIR/" 2>/dev/null || true
chmod 600 "$DIR/CREDENTIALS.txt" 2>/dev/null || true

echo "$JUMLAH tabel · $DIR"

# 5) Buang backup lebih tua dari N hari
find "$TUJUAN" -maxdepth 1 -type d -name '20*' -mtime +"$SIMPAN_HARI" -exec rm -rf {} + 2>/dev/null || true
