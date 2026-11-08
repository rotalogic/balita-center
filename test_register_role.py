#!/usr/bin/env python3
"""Tes: daftar dengan pilihan peran, super_admin ditolak, persetujuan admin, nama user di /api/me."""
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

import os

BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
ADMIN_PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
ok = True


def check(label, cond, extra=""):
    global ok
    print(f"{'PASS' if cond else 'FAIL'}  {label}{' — ' + extra if extra else ''}")
    ok = ok and cond


def session():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(op, path, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(BASE + path, data, {"Content-Type": "application/json"}, method=method)
    try:
        with op.open(request, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def as_json(body):
    try:
        return json.loads(body)
    except Exception:
        return {}


def psql(sql_text):
    return subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql_text],
        capture_output=True, text=True).stdout.strip()


def user_id(email):
    return psql(f"SELECT id FROM users WHERE email='{email}'")


SUF = secrets.token_hex(3)
PASS = "RahasiaDaftar123"
ORG = f"TEST - Sekolah {SUF}"

admin = session()
call(admin, "/api/auth/login", {"email": "admin@balitacenter.id", "password": ADMIN_PASSWORD})


def daftar(email, nama, role=None):
    """Daftar lalu setujui sebagai admin. Mengembalikan (status_code, json) hasil registrasi."""
    payload = {"full_name": nama, "email": email, "password": PASS, "organization_name": ORG}
    if role:
        payload["role"] = role
    code, body = call(session(), "/api/auth/register", payload)
    return code, as_json(body)


def setujui(email):
    uid = user_id(email)
    return call(admin, f"/api/users/{uid}", {"status": "aktif"}, method="PATCH")


anon = session()

# ---------- daftar peran publik ----------
code, body = call(anon, "/api/auth/roles")
data = as_json(body)
codes = [r["code"] for r in data.get("roles", [])]
check("daftar peran terbuka", code == 200 and data.get("ok"), f"HTTP {code}")
check("super_admin TIDAK ada di pilihan", "super_admin" not in codes, ",".join(codes))
check("peran murid tersedia", "murid" in codes)
check("peran guru tersedia", "guru" in codes)
check("jumlah peran = 10", len(codes) == 10, f"{len(codes)} peran")

# ---------- super_admin & peran asing ditolak ----------
code, body = call(anon, "/api/auth/register", {
    "full_name": "Nakal Admin", "email": f"nakal-{SUF}@example.com",
    "password": PASS, "role": "super_admin", "organization_name": ORG,
})
check("daftar sebagai super_admin ditolak (403)", code == 403, f"HTTP {code}")

code, body = call(anon, "/api/auth/register", {
    "full_name": "Peran Aneh", "email": f"aneh-{SUF}@example.com",
    "password": PASS, "role": "dewa", "organization_name": ORG,
})
check("peran tidak dikenal ditolak (400)", code == 400, f"HTTP {code}")

code, body = call(anon, "/api/auth/register", {
    "full_name": "Tanpa Org", "email": f"noorg-{SUF}@example.com", "password": PASS,
})
check("tanpa organisasi ditolak (400)", code == 400, f"HTTP {code}")

# ---------- murid ----------
murid_email = f"murid-{SUF}@example.com"
code, r = daftar(murid_email, "Aisyah Putri", "murid")
check("daftar sebagai murid", code == 200 and r.get("ok"), f"HTTP {code}")
check("murid menunggu persetujuan", r.get("pending") is True, str(r.get("pending")))
check("murid diarahkan ke portal /connect", r.get("redirect") == "/connect", str(r.get("redirect")))
check("peran murid tersimpan", psql(f"SELECT role FROM users WHERE email='{murid_email}'") == "murid")

code, body = call(session(), "/api/auth/login", {"email": murid_email, "password": PASS})
check("belum bisa masuk sebelum disetujui", code == 403, f"HTTP {code}")

setujui(murid_email)
murid = session()
code, body = call(murid, "/api/auth/login", {"email": murid_email, "password": PASS})
check("bisa masuk setelah disetujui", code == 200, f"HTTP {code}")

code, body = call(murid, "/api/me")
user = as_json(body).get("user", {})
check("nama user tampil di /api/me", user.get("full_name") == "Aisyah Putri", str(user.get("full_name")))

# ---------- guru ----------
guru_email = f"guru-{SUF}@example.com"
code, r = daftar(guru_email, "Bu Rina Guru", "guru")
check("daftar sebagai guru", code == 200 and r.get("ok"), f"HTTP {code}")
check("guru diarahkan ke aplikasi /", r.get("redirect") == "/", str(r.get("redirect")))
setujui(guru_email)

guru = session()
call(guru, "/api/auth/login", {"email": guru_email, "password": PASS})
code, body = call(guru, "/api/me")
perms = as_json(body).get("user", {}).get("permissions", [])
check("guru dapat izin mengajar", "students.view" in perms and "daily_reports.create" in perms,
      ",".join(perms[:6]))

code, body = call(guru, "/api/children")
check("guru boleh lihat anak didik", code == 200, f"HTTP {code}")

# ---------- orang tua (peran default) ----------
ortu_email = f"ortu-{SUF}@example.com"
code, r = daftar(ortu_email, "Bunda Sari")
check("daftar tanpa peran -> orang_tua", r.get("redirect") == "/connect", str(r.get("redirect")))
check("peran default orang_tua", psql(f"SELECT role FROM users WHERE email='{ortu_email}'") == "orang_tua")

# ---------- bersihkan ----------
for email in (murid_email, guru_email, ortu_email):
    uid = user_id(email)
    if uid:
        psql(f"DELETE FROM user_branches WHERE user_id='{uid}'")
        psql(f"DELETE FROM password_resets WHERE user_id='{uid}'")
        psql(f"DELETE FROM user_roles WHERE user_id='{uid}'")
    psql(f"DELETE FROM users WHERE email='{email}'")
check("akun tes dibersihkan", psql(f"SELECT count(*) FROM users WHERE email LIKE '%-{SUF}@example.com'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
