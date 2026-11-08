#!/usr/bin/env python3
"""Tes RBAC, pendaftaran mandiri, lupa kata sandi, dan 2FA (TOTP)."""
import base64
import hashlib
import hmac
import http.cookiejar
import json
import secrets
import struct
import subprocess
import sys
import time
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


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def session(follow=True):
    jar = http.cookiejar.CookieJar()
    handlers = [urllib.request.HTTPCookieProcessor(jar)]
    if not follow:
        handlers.append(NoRedirect())
    return urllib.request.build_opener(*handlers), jar


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


# ---- TOTP (RFC 6238) di sisi klien untuk menguji server
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def base32_decode(value):
    clean = value.upper().replace("=", "")
    bits = 0
    acc = 0
    out = bytearray()
    for char in clean:
        idx = ALPHABET.find(char)
        if idx < 0:
            continue
        acc = (acc << 5) | idx
        bits += 5
        if bits >= 8:
            out.append((acc >> (bits - 8)) & 0xFF)
            bits -= 8
    return bytes(out)


def totp(secret, at=None):
    counter = int((at or time.time()) // 30)
    key = base32_decode(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{code % 1000000:06d}"

SUF = secrets.token_hex(3)
PARENT_EMAIL = f"tes-ortu-{SUF}@example.com"
PARENT_PASS = "RahasiaOrtu123"
NEW_PASS = "RahasiaBaru456"

# ============ 1. login admin & profil ============
admin, _ = session()
code, body = call(admin, "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
check("login admin", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(admin, "/api/me")
me = as_json(body).get("user") or {}
check("profil admin terisi", code == 200 and me.get("email") == ADMIN_EMAIL, f"HTTP {code}")
check("admin punya izin settings.manage", "settings.manage" in me.get("permissions", []),
      f"{len(me.get('permissions', []))} izin")

# ============ 2. pendaftaran mandiri ============
# Pakai opener terpisah: /api/auth/register menyetel cookie sesi user baru,
# jadi jangan dipakai pada opener milik admin.
signup, _ = session()
code, body = call(signup, "/api/auth/register", {
    "full_name": "Orang Tua Tes", "email": PARENT_EMAIL, "password": PARENT_PASS, "phone": "0812" + SUF,
    "organization_name": "TEST - Sekolah RBAC",
})
check("daftar akun baru", code == 200 and as_json(body).get("ok"), f"HTTP {code} {as_json(body).get('error','')[:60]}")
check("pendaftar menunggu persetujuan", as_json(body).get("pending") is True, str(as_json(body).get("pending")))

# Setujui sebagai Super Admin, lalu login (pendaftar mandiri tidak langsung dapat sesi).
_parent_id = psql(f"SELECT id FROM users WHERE email='{PARENT_EMAIL}'")
call(admin, f"/api/users/{_parent_id}", {"status": "aktif"}, method="PATCH")
call(signup, "/api/auth/login", {"email": PARENT_EMAIL, "password": PARENT_PASS})

code, body = call(signup, "/api/auth/register", {
    "full_name": "Duplikat", "email": PARENT_EMAIL, "password": PARENT_PASS, "organization_name": "TEST - Sekolah RBAC",
})
check("email duplikat ditolak", code == 409, f"HTTP {code}")

code, body = call(signup, "/api/auth/register", {
    "full_name": "Pendek", "email": f"x-{SUF}@example.com", "password": "123", "organization_name": "TEST - Sekolah RBAC",
})
check("kata sandi lemah ditolak", code == 400, f"HTTP {code}")

# role & user_roles terpasang
role = psql(f"SELECT role FROM users WHERE email='{PARENT_EMAIL}'")
check("peran default orang_tua", role == "orang_tua", role)
# izin diturunkan dari users.role (user_roles butuh branch_id, tidak diisi untuk pendaftar mandiri)
mapped = psql(f"SELECT count(*) FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='orang_tua'")
check("peran orang_tua punya pemetaan izin", int(mapped) > 0, f"{mapped} izin")

# ============ 3. RBAC menahan peran orang tua ============
parent, _ = session()
code, body = call(parent, "/api/auth/login", {"email": PARENT_EMAIL, "password": PARENT_PASS})
check("login orang tua", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(parent, "/api/me")
pme = as_json(body).get("user") or {}
check("izin orang tua terbatas", "child.view_own" in pme.get("permissions", []), ",".join(pme.get("permissions", [])))
check("orang tua TIDAK punya students.view", "students.view" not in pme.get("permissions", []))

code, body = call(parent, "/api/children")
check("orang tua ditolak di /api/children (403)", code == 403, f"HTTP {code}")

code, body = call(parent, "/api/stats")
check("orang tua ditolak di /api/stats (403)", code == 403, f"HTTP {code}")

code, body = call(parent, "/api/meta")
check("orang tua ditolak di /api/meta (403)", code == 403, f"HTTP {code}")

code, body = call(parent, "/api/connect")
check("orang tua boleh /api/connect", code == 200, f"HTTP {code}")

# pengalihan halaman
nofollow, _ = session(follow=False)
call(nofollow, "/api/auth/login", {"email": PARENT_EMAIL, "password": PARENT_PASS})
code, _ = call(nofollow, "/")
check("orang tua diarahkan dari / ke /connect", code in (302, 303, 307, 308), f"HTTP {code}")

# ============ 4. lupa kata sandi ============
anon, _ = session()
code, body = call(anon, "/api/auth/forgot", {"email": PARENT_EMAIL})
check("permintaan reset diterima", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(anon, "/api/auth/forgot", {"email": "tidak-ada@example.com"})
check("email tak dikenal tetap balas generik", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

logs = subprocess.run(["sudo", "docker", "logs", os.environ.get("CONTAINER", "balita-app")],
                      capture_output=True, text=True)
token_marker = [line for line in (logs.stdout + logs.stderr).splitlines() if f"email={PARENT_EMAIL}" in line]
token = token_marker[-1].split("token=")[-1].strip() if token_marker else ""
check("tautan reset tercatat di log", bool(token), token[:12] + "…")

code, body = call(anon, "/api/auth/reset", {"token": token, "password": NEW_PASS})
check("reset kata sandi", code == 200 and as_json(body).get("ok"), f"HTTP {code} {as_json(body).get('error','')[:60]}")

code, body = call(anon, "/api/auth/reset", {"token": token, "password": "LagiLagi123"})
check("token tidak bisa dipakai ulang", code == 400, f"HTTP {code}")

fresh, _ = session()
code, body = call(fresh, "/api/auth/login", {"email": PARENT_EMAIL, "password": NEW_PASS})
check("login dengan kata sandi baru", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(fresh, "/api/auth/login", {"email": PARENT_EMAIL, "password": PARENT_PASS})
check("kata sandi lama tidak berlaku", code == 401, f"HTTP {code}")

# ============ 5. 2FA pada akun admin ============
# Sesi admin baru, supaya tidak tercampur cookie dari langkah sebelumnya.
admin, _ = session()
call(admin, "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})

code, body = call(admin, "/api/auth/2fa/setup", {}, method="POST")
setup = as_json(body)
check("setup 2FA memberi secret", code == 200 and bool(setup.get("secret")), f"HTTP {code}")

secret = setup.get("secret", "")
code, body = call(admin, "/api/auth/2fa/enable", {"code": "000000"})
check("kode salah ditolak saat aktivasi", code == 400, f"HTTP {code}")

code, body = call(admin, "/api/auth/2fa/enable", {"code": totp(secret)})
check("2FA aktif", code == 200 and as_json(body).get("ok"), f"HTTP {code} {as_json(body).get('error','')[:60]}")

two, _ = session()
code, body = call(two, "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
check("login minta kode 2FA", as_json(body).get("needs2fa") is True, f"HTTP {code}")

code, body = call(two, "/api/auth/login/verify", {"code": "000000"})
check("kode 2FA salah ditolak", code == 401, f"HTTP {code}")

code, body = call(two, "/api/auth/login/verify", {"code": totp(secret)})
check("verifikasi 2FA berhasil", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(two, "/api/children")
check("sesi penuh setelah 2FA", code == 200, f"HTTP {code}")

# matikan lagi supaya admin tidak terkunci
code, body = call(two, "/api/auth/2fa/disable", {"code": totp(secret)})
check("2FA bisa dimatikan", code == 200 and as_json(body).get("ok"), f"HTTP {code}")

code, body = call(admin, "/api/me")
check("admin masih bisa akses setelah 2FA dimatikan", code == 200, f"HTTP {code}")

# ============ 6. bersihkan ============
psql(f"DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE email='{PARENT_EMAIL}')")
psql(f"DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email='{PARENT_EMAIL}')")
psql(f"DELETE FROM users WHERE email='{PARENT_EMAIL}'")
left = psql(f"SELECT count(*) FROM users WHERE email='{PARENT_EMAIL}'")
check("akun tes dibersihkan", left == "0", f"count={left}")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
