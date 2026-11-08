#!/usr/bin/env bash
# Pemicu job tagihan Balita Center dari cron server.
#
# Pemakaian:
#   ./job-tagihan.sh buat       -> buat tagihan periode bulan berikutnya
#   ./job-tagihan.sh pengingat  -> kirim pengingat H-3 & H+1 yang jatuh hari ini
#
# Wajib di env (atau file /etc/balita-center/job.env):
#   APP_URL    alamat aplikasi, mis. https://balita.rotalogic.id
#   JOB_TOKEN  harus sama persis dengan JOB_TOKEN di env aplikasi
#
# Contoh baris crontab (zona waktu Asia/Jakarta) ada di PANDUAN-DEPLOY.md.
set -euo pipefail

if [ -f /etc/balita-center/job.env ]; then
  # shellcheck disable=SC1091
  set -a; . /etc/balita-center/job.env; set +a
fi

AKSI="${1:-pengingat}"
APP_URL="${APP_URL:?APP_URL belum diisi}"
JOB_TOKEN="${JOB_TOKEN:?JOB_TOKEN belum diisi}"

curl -fsS -X POST "${APP_URL%/}/api/jobs/tagihan" \
  -H "Content-Type: application/json" \
  -H "x-job-token: ${JOB_TOKEN}" \
  -d "{\"aksi\":\"${AKSI}\"}" \
  --max-time 120
echo
