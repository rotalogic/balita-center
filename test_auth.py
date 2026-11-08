#!/usr/bin/env python3
"""Tes login email+password Balita Center."""
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

import os
BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
EMAIL = "admin@balitacenter.id"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
ok = True


def check(label, cond, extra=""):
    global ok
    print(f"{'PASS' if cond else 'FAIL'}  {label}{' — ' + extra if extra else ''}")
    ok = ok and cond


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def opener(follow=True):
    jar = http.cookiejar.CookieJar()
    handlers = [urllib.request.HTTPCookieProcessor(jar)]
    if not follow:
        handlers.append(NoRedirect)
    return urllib.request.build_opener(*handlers), jar


def req(op, path, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(BASE + path, data,
                                     {"Content-Type": "application/json"},
                                     method=method)
    try:
        with op.open(request, timeout=25) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


anon, _ = opener(follow=False)

# 1. tanpa login
code, _ = req(anon, "/")
check("halaman tanpa login dialihkan ke /login", code in (302, 303, 307, 308), f"HTTP {code}")

code, body = req(anon, "/api/children")
check("API tanpa login ditolak 401", code == 401, f"HTTP {code}")

# 2. login page bisa dibuka
code, body = req(anon, "/login")
check("halaman login terbuka", code == 200 and "Kata Sandi" in body, f"HTTP {code}")

# 3. password salah
code, body = req(anon, "/api/auth/login", {"email": EMAIL, "password": "salah-sekali"})
check("password salah ditolak", code == 401, f"HTTP {code}")

# 4. email tidak dikenal
code, body = req(anon, "/api/auth/login", {"email": "tidakada@example.com", "password": PASSWORD})
check("email tak dikenal ditolak", code == 401, f"HTTP {code}")

# 5. login benar
user, jar = opener()
code, body = req(user, "/api/auth/login", {"email": EMAIL, "password": PASSWORD})
check("login benar", code == 200 and json.loads(body).get("ok"), f"HTTP {code}")
cookies = {c.name: c.value for c in jar}
check("cookie sesi terpasang", "sess" in cookies, ", ".join(cookies))

# 6. akses setelah login
code, body = req(user, "/")
check("dashboard terbuka setelah login", code == 200, f"HTTP {code}")
code, body = req(user, "/api/children")
check("API terbuka setelah login", code == 200, f"HTTP {code}")
code, body = req(user, "/api/stats")
check("API stats terbuka", code == 200, f"HTTP {code}")

# 7. cookie dipalsukan ditolak
fake, _ = opener(follow=False)
fake.addheaders = [("Cookie", "sess=00000000-0000-0000-0000-000000000000.9999999999.palsu")]
code, _ = req(fake, "/api/children")
check("cookie palsu ditolak", code == 401, f"HTTP {code}")

# 8. logout
code, body = req(user, "/api/auth/logout", {}, method="POST")
check("logout berhasil", code == 200, f"HTTP {code}")
code, _ = req(user, "/api/children")
check("setelah logout API ditolak", code == 401, f"HTTP {code}")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
