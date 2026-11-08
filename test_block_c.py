#!/usr/bin/env python3
"""Blok C: registrasi menunggu persetujuan, undangan, reset, dan isolasi cabang."""
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

# ---------- data uji: dua cabang ----------
def buat(kind, payload):
    _, body = call(admin, "/api/meta", {"kind": kind, **payload})
    return body.get("item", {}).get("id")

br_a = buat("branch", {"code": f"TESTCA{SUF}", "name": f"TEST - Cabang A {SUF}"})
br_b = buat("branch", {"code": f"TESTCB{SUF}", "name": f"TEST - Cabang B {SUF}"})
pr_a = buat("program", {"code": f"TESTCA{SUF}", "name": f"TEST - Program A {SUF}", "monthly_fee": 500000})
pr_b = buat("program", {"code": f"TESTCB{SUF}", "name": f"TEST - Program B {SUF}", "monthly_fee": 500000})
kl_a = buat("class", {"branch_id": br_a, "program_id": pr_a, "name": f"TEST - Kelas A {SUF}"})
kl_b = buat("class", {"branch_id": br_b, "program_id": pr_b, "name": f"TEST - Kelas B {SUF}"})
check("dua cabang siap", all([br_a, br_b, pr_a, pr_b, kl_a, kl_b]))

call(admin, "/api/children", {"branch_id": br_a, "program_id": pr_a, "class_id": kl_a,
                              "full_name": f"TEST - Anak A {SUF}", "birth_date": "2022-01-01", "gender": "laki-laki"})
call(admin, "/api/children", {"branch_id": br_b, "program_id": pr_b, "class_id": kl_b,
                              "full_name": f"TEST - Anak B {SUF}", "birth_date": "2022-02-02", "gender": "perempuan"})

# ---------- 1. registrasi tanpa organisasi ditolak ----------
newbie = session()
code, body = call(newbie, "/api/auth/register", {
    "full_name": "TEST - Tanpa Org", "email": f"test-noorg-{SUF.lower()}@example.com", "password": "Rahasia12345",
})
check("registrasi tanpa organisasi ditolak", code == 400, f"HTTP {code} {body.get('error','')[:40]}")

# ---------- 2. registrasi lengkap -> menunggu persetujuan ----------
email_guru = f"test-guru-{SUF.lower()}@example.com"
code, body = call(newbie, "/api/auth/register", {
    "full_name": f"TEST - Guru {SUF}", "email": email_guru, "password": "Rahasia12345",
    "role": "guru", "organization_name": f"TEST - Sekolah {SUF}",
})
check("registrasi berhasil", code == 200 and body.get("ok"), f"HTTP {code}")
check("status pending dilaporkan", body.get("pending") is True, str(body.get("pending")))
check("tidak langsung dapat sesi", body.get("redirect") is None or "sess" not in json.dumps(body).lower())
status = psql(f"SELECT status FROM users WHERE email='{email_guru}'")
check("DB: menunggu_persetujuan", status == "menunggu_persetujuan", status)

# ---------- 3. belum bisa masuk ----------
dup = session()
code, body = call(dup, "/api/auth/login", {"email": email_guru, "password": "Rahasia12345"})
check("login ditolak saat menunggu", code == 403, f"HTTP {code}")
check("pesan menyebut persetujuan", "persetujuan" in body.get("error", "").lower(), body.get("error", "")[:60])

# ---------- 4. admin menyetujui ----------
code, body = call(admin, "/api/users")
pengguna = [u for u in body.get("users", []) if u["email"] == email_guru]
check("admin melihat pengguna baru", len(pengguna) == 1, f"{len(pengguna)} baris")
check("daftar membawa status", pengguna and pengguna[0]["status"] == "menunggu_persetujuan")
uid = pengguna[0]["id"] if pengguna else None

code, body = call(admin, f"/api/users/{uid}", {"status": "aktif"}, method="PATCH")
check("admin menyetujui akun", code == 200 and body.get("ok"), f"HTTP {code}")

guru = session()
code, body = call(guru, "/api/auth/login", {"email": email_guru, "password": "Rahasia12345"})
check("login berhasil setelah disetujui", code == 200, f"HTTP {code}")

# ---------- 5. isolasi cabang ----------
call(admin, f"/api/users/{uid}", {"branch_id": br_a}, method="PATCH")
code, body = call(guru, "/api/children")
nama = [c["full_name"] for c in body.get("children", [])]
check("guru cabang A hanya lihat anak cabang A",
      any("Anak A" in n for n in nama) and not any("Anak B" in n for n in nama),
      f"{len(nama)} anak")

code, body = call(admin, "/api/children")
nama_admin = [c["full_name"] for c in body.get("children", [])]
check("super admin tetap lihat semua cabang",
      any("Anak A" in n for n in nama_admin) and any("Anak B" in n for n in nama_admin),
      f"{len(nama_admin)} anak")

# ---------- 6. undangan + aktivasi ----------
email_inv = f"test-inv-{SUF.lower()}@example.com"
code, body = call(admin, "/api/users", {
    "full_name": f"TEST - Undangan {SUF}", "email": email_inv, "role": "staf_hr", "branch_id": br_b,
})
url = body.get("activation_url", "")
check("undangan dibuat", code == 200 and bool(url), f"HTTP {code} {body.get('error','')[:40]}")
check("tautan aktivasi memakai token", "/reset?token=" in url, url[:60])

token = url.split("token=")[-1]
invitee = session()
code, body = call(invitee, "/api/auth/reset", {"token": token, "password": "RahasiaUndangan1"})
check("aktivasi lewat tautan", code == 200 and body.get("ok"), f"HTTP {code} {body.get('error','')[:40]}")
st2 = psql(f"SELECT status FROM users WHERE email='{email_inv}'")
check("status jadi aktif setelah aktivasi", st2 == "aktif", st2)

code, body = call(invitee, "/api/auth/login", {"email": email_inv, "password": "RahasiaUndangan1"})
check("pengguna undangan bisa masuk", code == 200, f"HTTP {code}")

# ---------- 7. tautan reset dari admin ----------
code, body = call(admin, f"/api/users/{uid}/reset-link", method="POST")
reset_url = body.get("reset_url", "")
check("admin bisa buat tautan reset", code == 200 and "/reset?token=" in reset_url, f"HTTP {code}")

reset_token = reset_url.split("token=")[-1]
code, body = call(session(), "/api/auth/reset", {"token": reset_token, "password": "RahasiaBaru999"})
check("reset kata sandi berhasil", code == 200 and body.get("ok"), f"HTTP {code}")
code, body = call(session(), "/api/auth/login", {"email": email_guru, "password": "RahasiaBaru999"})
check("login dengan sandi baru", code == 200, f"HTTP {code}")

# ---------- bersihkan ----------
for email in (email_guru, email_inv):
    psql(f"DELETE FROM user_branches WHERE user_id IN (SELECT id FROM users WHERE email='{email}')")
    psql(f"DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE email='{email}')")
    psql(f"DELETE FROM users WHERE email='{email}'")
for br in (br_a, br_b):
    psql(f"DELETE FROM enrollments WHERE child_id IN (SELECT id FROM children WHERE branch_id='{br}')")
    psql(f"DELETE FROM child_guardians WHERE child_id IN (SELECT id FROM children WHERE branch_id='{br}')")
    psql(f"DELETE FROM children WHERE branch_id='{br}'")
    psql(f"DELETE FROM classes WHERE branch_id='{br}'")
    psql(f"DELETE FROM staff WHERE branch_id='{br}'")
psql(f"DELETE FROM programs WHERE code LIKE 'TESTC%{SUF}'")
psql(f"DELETE FROM branches WHERE code LIKE 'TESTC%{SUF}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM branches WHERE code LIKE 'TESTC%{SUF}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
