#!/usr/bin/env bash
# Job tagihan SPP bulanan + pengingat H-3/H+1. Token dibaca dari file, bukan ditulis di cron.
set -euo pipefail
TOKEN="$(cat /opt/balita-center/.job_token)"
URL="https://balita.rotalogic.id/api/jobs/tagihan"
curl -s -X POST "$URL" -H "Content-Type: application/json" -H "x-job-token: $TOKEN" -d '{"aksi":"buat"}'
echo
curl -s -X POST "$URL" -H "Content-Type: application/json" -H "x-job-token: $TOKEN" -d '{"aksi":"pengingat"}'
echo
