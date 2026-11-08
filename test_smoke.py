#!/usr/bin/env python3
"""Smoke test Balita Center (Next.js): login -> data awal -> anak -> laporan harian -> publish."""
import http.cookiejar
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

import os
BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
LOGIN_EMAIL = "admin@balitacenter.id"
LOGIN_PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
ok = True

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def check(label, cond, extra=""):
    global ok
    print(f"{'PASS' if cond else 'FAIL'}  {label}{' — ' + extra if extra else ''}")
    ok = ok and cond


def call(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data, {"Content-Type": "application/json"})
    try:
        with opener.open(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def psql(sql_text):
    return subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d",
         "balita_center", "-tAc", sql_text], capture_output=True, text=True).stdout.strip()


# 0. pakai kode unik per run supaya tidak bentrok
import secrets
SUF = secrets.token_hex(3).upper()

# 0b. login dulu — semua API butuh sesi
code, r = call("/api/auth/login", {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD})
check("login untuk tes", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:60]}")

# 1. data awal: cabang -> program -> kelas -> staf
code, r = call("/api/meta", {"kind": "branch", "code": f"TES{SUF}", "name": f"Cabang Tes {SUF}", "city": "Malang"})
check("buat cabang", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:80]}")
branch_id = (r.get("item") or {}).get("id")

code, r = call("/api/meta", {"kind": "program", "code": f"TES{SUF}-TK", "name": f"Tes TK {SUF}", "monthly_fee": 500000})
check("buat program", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:80]}")
program_id = (r.get("item") or {}).get("id")

code, r = call("/api/meta", {"kind": "class", "branch_id": branch_id, "program_id": program_id, "name": f"Tes Kelas {SUF}"})
check("buat kelas", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:80]}")
class_id = (r.get("item") or {}).get("id")

code, r = call("/api/meta", {"kind": "staff", "branch_id": branch_id, "full_name": f"Tes Fasilitator {SUF}",
                             "position": "Fasilitator"})
check("buat staf", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:80]}")
staff_id = (r.get("item") or {}).get("id")

code, r = call("/api/meta")
check("meta memuat 4 data awal",
      code == 200 and len(r.get("branches", [])) >= 1 and len(r.get("programs", [])) >= 1
      and len(r.get("classes", [])) >= 1 and len(r.get("staff", [])) >= 1, f"HTTP {code}")

# 2. anak + enrollment
code, r = call("/api/children", {
    "branch_id": branch_id, "class_id": class_id, "program_id": program_id,
    "full_name": f"Tes Anak {SUF}", "nickname": "Tes", "birth_date": "2023-05-01",
    "gender": "L", "enrolled_on": "2026-07-01",
})
check("buat anak + enrollment", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:80]}")
child_id = (r.get("child") or r.get("item") or {}).get("id") or psql(
    f"SELECT id FROM children WHERE full_name='Tes Anak {SUF}'")

code, r = call("/api/children?q=" + urllib.parse.quote("Tes Anak"))
check("anak muncul di daftar",
      code == 200 and any(c["full_name"] == f"Tes Anak {SUF}" for c in r.get("children", [])), f"HTTP {code}")

# 3. daily report -> review -> terbitkan (trigger DB menjaga syarat terbit)
code, r = call("/api/daily-reports", {
    "branch_id": branch_id, "class_id": class_id, "child_id": child_id,
    "report_date": "2026-10-01", "created_by": staff_id, "lead_facilitator_id": staff_id,
    "notes": "Hari tes", "submit": True,
    "activities": [{"title": "Circle Time", "rating": 5, "apparatus": "Baki", "area": "Kognitif",
                    "photo_url": "https://example.com/foto.jpg"}],
})
check("buat laporan harian", code == 200 and r.get("ok"), f"HTTP {code} {r.get('error','')[:100]}")
rid = r.get("id")
check("id laporan diterima", bool(rid), str(rid)[:8])

if rid:
    code, r = call(f"/api/daily-reports/{rid}/review",
                   {"action": "terbitkan", "reviewer_id": staff_id})
    check("terbitkan laporan (trigger terpenuhi)", code == 200 and r.get("ok"),
          f"HTTP {code} {str(r.get('error',''))[:100]}")
    st = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
    check("status laporan = published", st == "published", f"status={st}")

# 4. hitung tabel di DB
for t in ("branches", "programs", "classes", "staff", "children", "enrollments"):
    n = psql(f"SELECT count(*) FROM {t}")
    check(f"tabel {t} terisi", n not in ("", "0"), f"count={n}")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
print("data tes dibiarkan di DB — bersihkan manual bila perlu")
sys.exit(0 if ok else 1)
