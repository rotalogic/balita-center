#!/usr/bin/env python3
"""Tes manajemen RBAC: super admin memberi peran ke user lain."""
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

import os
BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
ADMIN_EMAIL = "admin@balitacenter.id"
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


SUF = secrets.token_hex(3)
EMAIL = f"calon-{SUF}@example.com"
PASS = "CalonAdmin123"

# ---------- admin ----------
admin = session()
code, body = call(admin, "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
check("login admin", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

# ---------- daftar user baru (peran orang_tua) ----------
signup = session()
code, body = call(signup, "/api/auth/register", {"full_name": "Calon Admin", "email": EMAIL, "password": PASS, "organization_name": "TEST - Sekolah Manage"})
check("daftar user baru", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

new_id = psql(f"SELECT id FROM users WHERE email='{EMAIL}'")
check("user baru ada di DB", bool(new_id), new_id[:8])
call(admin, f"/api/users/{new_id}", {"status": "aktif"}, method="PATCH")
call(signup, "/api/auth/login", {"email": EMAIL, "password": PASS})

# ---------- daftar pengguna (butuh users.manage) ----------
code, body = call(admin, "/api/users")
data = as_json(body)
check("admin bisa lihat daftar pengguna", code == 200 and data.get("ok"), f"HTTP {code}")
check("daftar berisi role tersedia", len(data.get("roles", [])) == 11, f"{len(data.get('roles', []))} role")
check("user baru muncul di daftar", any(u["email"] == EMAIL for u in data.get("users", [])))

# ---------- user biasa tidak boleh mengelola ----------
code, body = call(signup, "/api/users")
check("orang tua ditolak di /api/users (403)", code == 403, f"HTTP {code}")

code, body = call(signup, f"/api/users/{new_id}", {"role": "super_admin"}, method="PATCH")
check("orang tua tidak bisa naikkan peran sendiri (403)", code == 403, f"HTTP {code}")

# ---------- super admin memberi peran ----------
code, body = call(admin, f"/api/users/{new_id}", {"role": "kepala_sekolah"}, method="PATCH")
check("beri peran kepala_sekolah", code == 200 and as_json(body).get("ok"), f"HTTP {code} {as_json(body).get('error','')[:60]}")
check("peran tersimpan di DB",
      psql(f"SELECT role FROM users WHERE email='{EMAIL}'") == "kepala_sekolah")

code, body = call(admin, f"/api/users/{new_id}", {"role": "super_admin"}, method="PATCH")
check("angkat jadi super_admin", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

# user itu sekarang punya seluruh izin
promoted = session()
code, body = call(promoted, "/api/auth/login", {"email": EMAIL, "password": PASS})
check("login user yang diangkat", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(promoted, "/api/me")
perms = as_json(body).get("user", {}).get("permissions", [])
check("super_admin baru punya 23 izin", len(perms) == 23, f"{len(perms)} izin")

code, body = call(promoted, "/api/users")
check("super_admin baru bisa kelola pengguna", code == 200, f"HTTP {code}")

# ---------- proteksi akun sendiri ----------
admin_id = psql(f"SELECT id FROM users WHERE email='{ADMIN_EMAIL}'")
code, body = call(admin, f"/api/users/{admin_id}", {"role": "orang_tua"}, method="PATCH")
check("tidak bisa ubah peran sendiri", code == 400, f"HTTP {code} {as_json(body).get('error','')[:50]}")

# ---------- peran tidak dikenal ----------
code, body = call(admin, f"/api/users/{new_id}", {"role": "dewa"}, method="PATCH")
check("peran tidak dikenal ditolak", code == 400, f"HTTP {code}")

# ---------- nonaktifkan akun ----------
code, body = call(admin, f"/api/users/{new_id}", {"is_active": False}, method="PATCH")
check("nonaktifkan akun", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

blocked = session()
code, body = call(blocked, "/api/auth/login", {"email": EMAIL, "password": PASS})
check("akun nonaktif tidak bisa login", code == 401, f"HTTP {code}")

code, body = call(admin, f"/api/users/{new_id}", {"is_active": True}, method="PATCH")
check("aktifkan kembali", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

# ---------- bersihkan ----------
psql(f"DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email='{EMAIL}')")
psql(f"DELETE FROM users WHERE email='{EMAIL}'")
check("akun tes dibersihkan",
      psql(f"SELECT count(*) FROM users WHERE email='{EMAIL}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
