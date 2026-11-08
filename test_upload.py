#!/usr/bin/env python3
"""Tes unggah foto anak + ketersediaan kelas."""
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:3011"
ADMIN = "admin@balitacenter.id"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
ok = True

# PNG 1x1 transparan
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6300010000050001a5f645400000000049454e44ae426082"
)


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


def upload(op, filename, content, mime="image/png"):
    boundary = uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {mime}\r\n\r\n".encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    request = urllib.request.Request(
        BASE + "/api/upload", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    try:
        with op.open(request, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def psql(sql_text):
    # Trigger database menolak hard delete anak; uji perlu izin eksplisit.
    if "DELETE FROM children" in sql_text:
        sql_text = "SET balita.izinkan_hapus='ya'; " + sql_text
    return subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql_text],
        capture_output=True, text=True).stdout.strip()


admin = session()
code, body = call(admin, "/api/auth/login", {"email": ADMIN, "password": PASSWORD})
check("login admin", code == 200, f"HTTP {code}")

anon = session()

# ---------- kelas tersedia ----------
code, body = call(admin, "/api/meta")
meta = json.loads(body)
check("meta memuat kelas", code == 200 and len(meta.get("classes", [])) > 0,
      f"{len(meta.get('classes', []))} kelas")
check("kelas punya branch & program",
      all(c.get("branch_id") and c.get("program_id") for c in meta.get("classes", [])))

# ---------- upload ----------
code, body = upload(admin, "foto.png", PNG)
data = json.loads(body)
check("unggah foto", code == 200 and data.get("ok"), f"HTTP {code} {data.get('error','')[:60]}")
photo_url = data.get("url", "")
check("dapat URL internal", photo_url.startswith("/api/files/"), photo_url)

code, body = upload(admin, "dokumen.txt", b"bukan gambar", mime="text/plain")
check("tolak non-gambar", code == 400, f"HTTP {code}")

code, body = upload(admin, "besar.png", PNG + b"\0" * (6 * 1024 * 1024))
check("tolak >5MB", code == 400, f"HTTP {code}")

# ---------- ambil berkas ----------
try:
    with admin.open(BASE + photo_url, timeout=20) as r:
        raw = r.read()
        ctype = r.headers.get("Content-Type", "")
    check("berkas bisa diambil", r.status == 200 and raw == PNG, f"{len(raw)} byte, {ctype}")
except Exception as e:
    check("berkas bisa diambil", False, str(e))

code, _ = call(anon, photo_url)
check("tanpa login ditolak (401)", code == 401, f"HTTP {code}")

code, _ = call(admin, "/api/files/../../etc/passwd")
check("path traversal ditolak", code in (400, 401, 404), f"HTTP {code}")

# ---------- simpan anak dengan foto ----------
suf = secrets.token_hex(3)
branch = meta["branches"][0]["id"]
program = meta["programs"][0]["id"]
klass = meta["classes"][0]["id"]

code, body = call(admin, "/api/children", {
    "branch_id": branch, "program_id": program, "class_id": klass,
    "full_name": f"Foto Tes {suf}", "birth_date": "2023-01-01", "gender": "perempuan",
    "photo_url": photo_url,
})
check("simpan anak + foto", code == 200 and json.loads(body).get("ok"), f"HTTP {code}")

saved = psql(f"SELECT photo_url FROM children WHERE full_name='Foto Tes {suf}'")
check("photo_url tersimpan di DB", saved == photo_url, str(saved))

# URL berbahaya harus ditolak
code, body = call(admin, "/api/children", {
    "branch_id": branch, "program_id": program, "class_id": klass,
    "full_name": f"Jahat {suf}", "photo_url": "javascript:alert(1)",
})
saved2 = psql(f"SELECT coalesce(photo_url,'NULL') FROM children WHERE full_name='Jahat {suf}'")
check("URL javascript: tidak disimpan", saved2 == "NULL", str(saved2))

# ---------- bersihkan ----------
psql(f"DELETE FROM enrollments WHERE child_id IN (SELECT id FROM children WHERE full_name LIKE '%{suf}')")
psql(f"DELETE FROM children WHERE full_name LIKE '%{suf}'")
check("data tes dibersihkan", psql(f"SELECT count(*) FROM children WHERE full_name LIKE '%{suf}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
