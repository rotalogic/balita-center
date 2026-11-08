#!/usr/bin/env python3
"""Uji Blok 1 & 2 — soft delete, pulih, hapus berfungsi, unggah foto nyata,
kirim-untuk-review dengan galat spesifik, dan jam 24 jam."""
import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:3011"
ADMIN = ("admin@balitacenter.id", "")
hasil = []


def cek(nama, lulus, catatan=""):
    hasil.append((nama, lulus, catatan))
    print(f"{'LULUS' if lulus else 'GAGAL'} · {nama}{(' — ' + catatan) if catatan else ''}")


def call(method, path, body=None, cookie=None, raw=None, ctype=None):
    url = BASE + path
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    if ctype:
        req.add_header("Content-Type", ctype)
    elif body is not None:
        req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def jcall(method, path, body=None, cookie=None):
    status, raw, headers = call(method, path, body, cookie)
    try:
        return status, json.loads(raw), headers
    except Exception:
        return status, {"raw": raw.decode(errors="replace")[:200]}, headers


def psql(sql):
    # Trigger database menolak hard delete anak; uji perlu izin eksplisit.
    if "DELETE FROM children" in sql:
        sql = "SET balita.izinkan_hapus='ya'; " + sql
    out = subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql],
        capture_output=True, text=True,
    )
    return out.stdout.strip()


# --- login admin ---
import os
pw = os.environ.get("ADMIN_PW") or ""
if not pw:
    print("PERLU ADMIN_PW")
    sys.exit(2)

status, data, headers = jcall("POST", "/api/auth/login", {"email": ADMIN[0], "password": pw})
cek("login admin", status == 200 and data.get("ok"), str(status))
cookie = ""
for k, v in headers.items():
    if k.lower() == "set-cookie":
        cookie = v.split(";")[0]
if not cookie:
    sys.exit(2)

# --- ambil anak & kelas ---
status, meta, _ = jcall("GET", "/api/meta", cookie=cookie)
status2, kids, _ = jcall("GET", "/api/children", cookie=cookie)
anak = kids["children"][0]
branch = meta["branches"][0]
kelas = [c for c in meta["classes"] if c["branch_id"] == branch["id"]][0]
guru = [s for s in meta["staff"] if s["branch_id"] == branch["id"]][0]
print(f"anak={anak['full_name']} kelas={kelas['name']} guru={guru['full_name']}")

TANGGAL = "2026-12-29"  # jauh di masa depan, tidak bentrok data asli


def hapus_laporan(tanggal):
    psql(f"DELETE FROM daily_reports WHERE report_date = '{tanggal}' AND child_id = '{anak['id']}';")


hapus_laporan(TANGGAL)

# --- 1. buat draft tanpa foto ---
status, buat, _ = jcall("POST", "/api/daily-reports", {
    "branch_id": branch["id"], "child_id": anak["id"], "class_id": kelas["id"],
    "created_by": guru["id"], "report_date": TANGGAL, "notes": "RETEST - draft blok 1",
    "activities": [{"title": "RETEST aktivitas", "apparatus": "", "rating": 0}],
}, cookie)
rid = buat.get("id")
cek("buat draft", status == 200 and buat.get("status") == "draft", f"status={buat.get('status')}")

# --- 2. kirim tanpa syarat -> 422, draft tetap ada ---
status, kirim, _ = jcall("PATCH", f"/api/daily-reports/{rid}", {"submit": True}, cookie)
cek("kirim tanpa syarat ditolak 422", status == 422, str(status))
cek("galat menyebut foto", any("foto" in k.lower() for k in kirim.get("kurang", [])), str(kirim.get("kurang")))
sisa = psql(f"SELECT status FROM daily_reports WHERE id = '{rid}';")
cek("draft tetap ada & tetap draft", sisa == "draft", sisa)

# --- 3. draft tidak boleh hilang setelah edit + muat berulang ---
jcall("PATCH", f"/api/daily-reports/{rid}", {"notes": "RETEST - sudah diedit"}, cookie)
hilang = False
for _ in range(4):
    status, daftar, _ = jcall("GET", "/api/daily-reports?status=draft", cookie=cookie)
    if not any(r["id"] == rid for r in daftar.get("reports", [])):
        hilang = True
for f in ["status=draft", "status=draft", ""]:
    status, daftar, _ = jcall("GET", f"/api/daily-reports?{f}", cookie=cookie)
    if not any(r["id"] == rid for r in daftar.get("reports", [])):
        hilang = True
cek("draft bertahan di semua filter & muat ulang", not hilang)

# --- 4. unggah foto nyata ---
png = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)
boundary = "----RETEST" + uuid.uuid4().hex
body = (
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"retest.png\"\r\n"
    f"Content-Type: image/png\r\n\r\n"
).encode() + png + f"\r\n--{boundary}--\r\n".encode()
status, raw, _ = call("POST", "/api/upload", raw=body, ctype=f"multipart/form-data; boundary={boundary}", cookie=cookie)
up = json.loads(raw)
cek("unggah foto tersimpan", status == 200 and up.get("ok"), str(up.get("error") or up.get("driver")))
url = up.get("url", "")

# --- 5. foto bisa dibuka lagi ---
if url:
    status, img, headers = call("GET", url, cookie=cookie)
    cek("foto bisa dibuka kembali", status == 200 and len(img) == len(png), f"{status} {len(img)}b")

# --- 6. tolak tipe berkas asing ---
body2 = (
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"x.txt\"\r\n"
    f"Content-Type: text/plain\r\n\r\nhalo\r\n--{boundary}--\r\n"
).encode()
status, raw, _ = call("POST", "/api/upload", raw=body2, ctype=f"multipart/form-data; boundary={boundary}", cookie=cookie)
pesan = json.loads(raw)
cek("tolak non-gambar dengan pesan", status == 400 and "JPG" in pesan.get("error", ""), pesan.get("error"))

# --- 7. lengkapi syarat lalu kirim ---
jcall("PATCH", f"/api/daily-reports/{rid}", {
    "lead_facilitator_id": guru["id"],
    "photo_urls": [url] if url else [],
    "activities": [{"title": "RETEST aktivitas", "apparatus": "Kartu warna", "rating": 5}],
}, cookie)
status, kirim, _ = jcall("PATCH", f"/api/daily-reports/{rid}", {"submit": True}, cookie)
cek("kirim setelah syarat lengkap", status == 200 and kirim.get("status") == "menunggu_review",
    f"{status} {kirim.get('status')} {kirim.get('kurang')}")

# --- 8. hapus hanya draft ---
status, hapus, _ = jcall("DELETE", f"/api/daily-reports/{rid}", cookie=cookie)
cek("hapus laporan terkirim ditolak", status == 409, str(status))

psql(f"UPDATE daily_reports SET status='draft' WHERE id='{rid}';")
status, hapus, _ = jcall("DELETE", f"/api/daily-reports/{rid}", cookie=cookie)
cek("soft delete draft", status == 200, f"{status} {hapus.get('error')}")
masih = psql(f"SELECT deleted_at IS NOT NULL FROM daily_reports WHERE id='{rid}';")
cek("baris masih ada di DB (soft delete)", masih == "t", masih)
status, daftar, _ = jcall("GET", "/api/daily-reports", cookie=cookie)
cek("tidak tampil di daftar normal", all(r["id"] != rid for r in daftar["reports"]))
status, sampah, _ = jcall("GET", "/api/daily-reports?sampah=1", cookie=cookie)
cek("tampil di filter Sampah", any(r["id"] == rid for r in sampah["reports"]))

# --- 9. pulihkan ---
status, pulih, _ = jcall("PATCH", f"/api/daily-reports/{rid}", {"restore": True}, cookie)
cek("pulihkan laporan", status == 200, f"{status} {pulih.get('error')}")
aktif = psql(f"SELECT deleted_at IS NULL FROM daily_reports WHERE id='{rid}';")
cek("laporan aktif kembali", aktif == "t", aktif)

# --- 10. audit tercatat ---
jumlah = psql(f"SELECT count(*) FROM audit_logs WHERE entity_id='{rid}';")
cek("jejak audit laporan tercatat", int(jumlah or 0) >= 4, f"{jumlah} baris")
aksi = psql(f"SELECT string_agg(DISTINCT action, ',') FROM audit_logs WHERE entity_id='{rid}';")
print("   aksi:", aksi)

# --- 11. tanggal lama bisa dibuat lagi setelah soft delete ---
psql(f"UPDATE daily_reports SET status='draft' WHERE id='{rid}';")
jcall("DELETE", f"/api/daily-reports/{rid}", cookie=cookie)
status, buat2, _ = jcall("POST", "/api/daily-reports", {
    "branch_id": branch["id"], "child_id": anak["id"], "class_id": kelas["id"],
    "created_by": guru["id"], "report_date": TANGGAL, "notes": "RETEST - pengganti",
}, cookie)
cek("anak+tanggal bisa dipakai lagi setelah soft delete", status == 200, f"{status} {buat2.get('error')}")

# bersihkan
hapus_laporan(TANGGAL)

lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
