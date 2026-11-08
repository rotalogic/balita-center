#!/usr/bin/env python3
"""Blok E3: pipeline Admission (lead -> trial -> diterima -> terdaftar)."""
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
WA = "6281" + secrets.randbelow(10**8).__str__().zfill(8)
ok = True


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


def session():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(op, path, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(BASE + path, data, {"Content-Type": "application/json"}, method=method)
    try:
        with op.open(request, timeout=40) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


admin = session()
call(admin, "/api/auth/login", {"email": "admin@balitacenter.id", "password": PASSWORD})

_, body = call(admin, "/api/meta", {"kind": "branch", "code": f"TESTF{SUF}", "name": f"TEST - Cabang F {SUF}"})
br = body.get("item", {}).get("id")
_, body = call(admin, "/api/meta", {"kind": "program", "code": f"TESTF{SUF}", "name": f"TEST - Program F {SUF}", "monthly_fee": 600000})
pr = body.get("item", {}).get("id")
_, body = call(admin, "/api/meta", {"kind": "class", "branch_id": br, "program_id": pr, "name": f"TEST - Kelas F {SUF}"})
kl = body.get("item", {}).get("id")
check("data awal siap", all([br, pr, kl]))

# ---------- 1. tambah lead ----------
code, body = call(admin, "/api/admission", {
    "parent_name": f"TEST - Ortu {SUF}", "child_name": f"TEST - Calon {SUF}",
    "wa_number": WA, "child_age_months": 40, "branch_id": br, "interested_program_id": pr,
})
lead_id = body.get("id")
check("lead dibuat", code == 200 and bool(lead_id), f"HTTP {code} {body.get('error','')[:50]}")
check("tahap awal lead_masuk", psql(f"SELECT stage FROM leads WHERE id='{lead_id}'") == "lead_masuk")

# ---------- 2. duplikat nomor ditolak ----------
code, body = call(admin, "/api/admission", {
    "parent_name": "TEST - Duplikat", "child_name": "TEST - Duplikat", "wa_number": WA,
})
check("nomor duplikat ditolak 409", code == 409, f"HTTP {code}")
check("duplikat menunjuk lead lama", body.get("existing_id") == lead_id)

# ---------- 3. validasi ----------
code, body = call(admin, "/api/admission", {"parent_name": "A", "child_name": "B", "wa_number": "123"})
check("nomor tidak valid ditolak", code == 400, f"HTTP {code}")

# ---------- 4. pindah tahap ----------
code, body = call(admin, f"/api/admission/{lead_id}", {"stage": "dihubungi"}, method="PATCH")
check("pindah ke dihubungi", code == 200 and body.get("ok"), f"HTTP {code}")

code, body = call(admin, f"/api/admission/{lead_id}", {"stage": "trial_terjadwal", "trial_at": "2026-11-20"}, method="PATCH")
check("jadwalkan trial", code == 200, f"HTTP {code}")
check("tanggal trial tersimpan", psql(f"SELECT trial_at::date FROM leads WHERE id='{lead_id}'") == "2026-11-20")

code, body = call(admin, f"/api/admission/{lead_id}", {"stage": "ngawur"}, method="PATCH")
check("tahap tidak dikenal ditolak", code == 400, f"HTTP {code}")

code, body = call(admin, f"/api/admission/{lead_id}", {"stage": "diterima"}, method="PATCH")
check("terima lead", code == 200, f"HTTP {code}")

# ---------- 5. ringkasan pipeline ----------
code, body = call(admin, "/api/admission")
counts = body.get("counts", {})
check("ringkasan memuat semua tahap", set(counts) >= {"lead_masuk", "dihubungi", "trial_terjadwal", "diterima", "terdaftar"},
      ",".join(counts))
check("hitung diterima >= 1", counts.get("diterima", 0) >= 1, str(counts.get("diterima")))

# ---------- 6. ubah jadi anak didik ----------
code, body = call(admin, "/api/children", {
    "branch_id": br, "program_id": pr, "class_id": kl,
    "full_name": f"TEST - Anak F {SUF}", "birth_date": "2022-06-06", "gender": "laki-laki",
    "lead_id": lead_id,
})
anak_id = body.get("id")
check("anak dibuat dari lead", code == 200 and bool(anak_id), f"HTTP {code}")

stage = psql(f"SELECT stage FROM leads WHERE id='{lead_id}'")
conv = psql(f"SELECT converted_child_id FROM leads WHERE id='{lead_id}'")
check("lead jadi terdaftar", stage == "terdaftar", stage)
check("lead menunjuk anak baru", conv == anak_id, conv)

# ---------- bersihkan ----------
psql(f"DELETE FROM enrollments WHERE child_id='{anak_id}'")
psql(f"DELETE FROM child_guardians WHERE child_id='{anak_id}'")
psql(f"DELETE FROM leads WHERE id='{lead_id}'")
psql(f"DELETE FROM children WHERE id='{anak_id}'")
psql(f"DELETE FROM classes WHERE id='{kl}'")
psql(f"DELETE FROM branches WHERE id='{br}'")
psql(f"DELETE FROM programs WHERE id='{pr}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM leads WHERE id='{lead_id}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
