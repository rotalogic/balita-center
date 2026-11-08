#!/usr/bin/env python3
"""Blok B: pesan duplikat manusiawi + tidak ada kebocoran SQL."""
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3011"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
SUF = secrets.token_hex(3).upper()
ok = True
BOCOR = ("constraint", "duplicate key", "violates", "syntax", "column", "relation")


def check(label, cond, extra=""):
    global ok
    print(f"{'PASS' if cond else 'FAIL'}  {label}{' — ' + extra if extra else ''}")
    ok = ok and cond


def psql(sql):
    # Trigger database menolak hard delete anak; uji perlu izin eksplisit.
    if "DELETE FROM children" in sql:
        sql = "SET balita.izinkan_hapus='ya'; " + sql
    return subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql],
        capture_output=True, text=True).stdout.strip()


op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(path, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(BASE + path, data, {"Content-Type": "application/json"}, method=method)
    try:
        with op.open(request, timeout=40) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


call("/api/auth/login", {"email": "admin@balitacenter.id", "password": PASSWORD})

_, body = call("/api/meta", {"kind": "branch", "code": f"TESTB{SUF}", "name": f"TEST - Cabang B {SUF}"})
branch = body.get("item", {}).get("id")
_, body = call("/api/meta", {"kind": "program", "code": f"TESTB{SUF}", "name": f"TEST - Program B {SUF}", "monthly_fee": 500000})
program = body.get("item", {}).get("id")
_, body = call("/api/meta", {"kind": "class", "branch_id": branch, "program_id": program, "name": f"TEST - Kelas B {SUF}"})
klass = body.get("item", {}).get("id")
_, body = call("/api/meta", {"kind": "staff", "branch_id": branch, "full_name": f"TEST - Guru B {SUF}", "position": "Guru"})
staff = body.get("item", {}).get("id")
_, body = call("/api/children", {"branch_id": branch, "program_id": program, "class_id": klass,
                                 "full_name": f"TEST - Anak B {SUF}", "birth_date": "2022-03-03", "gender": "perempuan"})
child = body.get("id")
check("data uji siap", all([branch, program, klass, staff, child]))

base_payload = {"branch_id": branch, "child_id": child, "class_id": klass, "created_by": staff,
                "report_date": "2026-11-10", "submit": False}

code, body = call("/api/daily-reports", base_payload)
rid1 = body.get("id")
check("laporan pertama dibuat", code == 200 and bool(rid1), f"HTTP {code}")

# ---------- duplikat anak + tanggal ----------
code, body = call("/api/daily-reports", base_payload)
pesan = body.get("error", "")
check("duplikat ditolak 409", code == 409, f"HTTP {code}")
check("pesan menyebut nama anak", f"TEST - Anak B {SUF}" in pesan, pesan[:80])
check("pesan menyebut tanggal Indonesia", "November" in pesan, pesan[:80])
check("disediakan existing_id", body.get("existing_id") == rid1, str(body.get("existing_id")))
check("pesan bebas istilah SQL", not any(k in pesan.lower() for k in BOCOR), pesan[:80])

code, body = call(f"/api/daily-reports/{rid1}")
check("existing_id bisa dibuka", code == 200 and body.get("ok"), f"HTTP {code}")

# ---------- 23505 lewat PATCH (pindah tanggal ke tanggal yang sudah ada) ----------
code, body = call("/api/daily-reports", {**base_payload, "report_date": "2026-11-11"})
rid2 = body.get("id")
check("laporan kedua (tanggal lain) dibuat", code == 200 and bool(rid2), f"HTTP {code}")

code, body = call(f"/api/daily-reports/{rid2}", {"report_date": "2026-11-10"}, method="PATCH")
pesan2 = body.get("error", "")
check("bentrok tanggal ditolak 409", code == 409, f"HTTP {code}")
check("pesan bentrok manusiawi", "sudah ada laporan" in pesan2.lower(), pesan2[:80])
check("pesan bentrok bebas SQL", not any(k in pesan2.lower() for k in BOCOR), pesan2[:80])

# ---------- bersihkan ----------
for rid in (rid1, rid2):
    if rid:
        psql(f"DELETE FROM daily_report_activities WHERE report_id='{rid}'")
        psql(f"DELETE FROM daily_report_photos WHERE report_id='{rid}'")
        psql(f"DELETE FROM daily_reports WHERE id='{rid}'")
psql(f"DELETE FROM enrollments WHERE child_id='{child}'")
psql(f"DELETE FROM child_guardians WHERE child_id='{child}'")
psql(f"DELETE FROM children WHERE id='{child}'")
psql(f"DELETE FROM staff WHERE id='{staff}'")
psql(f"DELETE FROM classes WHERE id='{klass}'")
psql(f"DELETE FROM programs WHERE id='{program}'")
psql(f"DELETE FROM branches WHERE id='{branch}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM branches WHERE id='{branch}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
