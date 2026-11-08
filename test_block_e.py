#!/usr/bin/env python3
"""Blok E (sebagian): isolasi Balita Connect — orang tua hanya lihat anaknya sendiri."""
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


def buat(kind, payload):
    _, body = call(admin, "/api/meta", {"kind": kind, **payload})
    return body.get("item", {}).get("id")


br = buat("branch", {"code": f"TESTE{SUF}", "name": f"TEST - Cabang E {SUF}"})
pr = buat("program", {"code": f"TESTE{SUF}", "name": f"TEST - Program E {SUF}", "monthly_fee": 500000})
kl = buat("class", {"branch_id": br, "program_id": pr, "name": f"TEST - Kelas E {SUF}"})
check("data awal siap", all([br, pr, kl]))

email_ortu = f"test-ortu-{SUF.lower()}@example.com"

# anak 1: wali memakai email orang tua yang akan login
_, body = call(admin, "/api/children", {
    "branch_id": br, "program_id": pr, "class_id": kl,
    "full_name": f"TEST - Anak Sendiri {SUF}", "birth_date": "2022-04-04", "gender": "perempuan",
    "guardian_name": f"TEST - Wali {SUF}", "guardian_email": email_ortu, "guardian_phone": "0812000",
})
anak_sendiri = body.get("id")
# anak 2: wali lain
_, body = call(admin, "/api/children", {
    "branch_id": br, "program_id": pr, "class_id": kl,
    "full_name": f"TEST - Anak Lain {SUF}", "birth_date": "2022-05-05", "gender": "laki-laki",
    "guardian_name": f"TEST - Wali Lain {SUF}", "guardian_email": f"lain-{SUF.lower()}@example.com",
})
anak_lain = body.get("id")
check("dua anak dibuat", all([anak_sendiri, anak_lain]))

# buat akun orang tua (undangan) + aktivasi
_, body = call(admin, "/api/users", {
    "full_name": f"TEST - Ortu {SUF}", "email": email_ortu, "role": "orang_tua",
})
token = (body.get("activation_url") or "").split("token=")[-1]
ortu = session()
call(ortu, "/api/auth/reset", {"token": token, "password": "RahasiaOrtu123"})
code, _ = call(ortu, "/api/auth/login", {"email": email_ortu, "password": "RahasiaOrtu123"})
check("orang tua bisa masuk", code == 200, f"HTTP {code}")

# ---------- inti: isolasi ----------
code, body = call(ortu, "/api/connect")
child = body.get("child") or {}
check("portal memuat anak sendiri", code == 200 and child.get("id") == anak_sendiri,
      f"HTTP {code} anak={child.get('full_name')}")

code, body = call(ortu, f"/api/connect?child_id={anak_lain}")
check("anak orang lain DITOLAK", code == 403, f"HTTP {code} {body.get('error','')[:50]}")

# orang tua tanpa wali terhubung
email_asing = f"test-asing-{SUF.lower()}@example.com"
_, body = call(admin, "/api/users", {"full_name": f"TEST - Asing {SUF}", "email": email_asing, "role": "orang_tua"})
token2 = (body.get("activation_url") or "").split("token=")[-1]
asing = session()
call(asing, "/api/auth/reset", {"token": token2, "password": "RahasiaAsing123"})
call(asing, "/api/auth/login", {"email": email_asing, "password": "RahasiaAsing123"})
code, body = call(asing, "/api/connect")
check("tanpa anak terhubung -> kosong + pesan", code == 200 and body.get("child") is None and bool(body.get("message")),
      str(body.get("message"))[:50])

# staf (super admin) tetap bisa pratinjau anak mana pun
code, body = call(admin, f"/api/connect?child_id={anak_lain}")
check("super admin bisa pratinjau", code == 200 and (body.get("child") or {}).get("id") == anak_lain,
      f"HTTP {code}")

# ---------- bersihkan ----------
for email in (email_ortu, email_asing):
    uid = psql(f"SELECT id FROM users WHERE email='{email}'")
    if uid:
        psql(f"DELETE FROM password_resets WHERE user_id='{uid}'")
        psql(f"DELETE FROM user_branches WHERE user_id='{uid}'")
    psql(f"DELETE FROM users WHERE email='{email}'")
psql(f"DELETE FROM enrollments WHERE child_id IN ('{anak_sendiri}','{anak_lain}')")
psql(f"DELETE FROM child_guardians WHERE child_id IN ('{anak_sendiri}','{anak_lain}')")
psql(f"DELETE FROM guardians WHERE email LIKE '%{SUF.lower()}@example.com'")
psql(f"DELETE FROM children WHERE id IN ('{anak_sendiri}','{anak_lain}')")
psql(f"DELETE FROM classes WHERE id='{kl}'")
psql(f"DELETE FROM branches WHERE id='{br}'")
psql(f"DELETE FROM programs WHERE id='{pr}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM users WHERE email='{email_ortu}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
