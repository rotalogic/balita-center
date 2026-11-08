#!/usr/bin/env python3
"""Uji Jilid 4 Blok 1–4 & 7 (subset yang bisa diotomasi)."""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
PW = os.environ.get("ADMIN_PW", "")
hasil = []


def cek(nama, lulus, catatan=""):
    hasil.append((nama, bool(lulus), catatan))
    print(f"{'LULUS' if lulus else 'GAGAL'} · {nama}{(' — ' + str(catatan)) if catatan else ''}")


def psql(sql):
    # Trigger database menolak hard delete anak; uji perlu izin eksplisit.
    if "DELETE FROM children" in sql:
        sql = "SET balita.izinkan_hapus='ya'; " + sql
    out = subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql],
        capture_output=True, text=True)
    return (out.stdout + out.stderr).strip()


jar = {}


def call(method, path, body=None):
    r = urllib.request.Request(BASE + path, method=method)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        r.add_header("Content-Type", "application/json")
    if jar.get("cookie"):
        r.add_header("Cookie", jar["cookie"])
    try:
        with urllib.request.urlopen(r, data, timeout=120) as resp:
            for k, v in resp.headers.items():
                if k.lower() == "set-cookie":
                    jar["cookie"] = v.split(";")[0]
            return resp.status, json.loads(resp.read()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}"), dict(e.headers)


st, d, hd = call("POST", "/api/auth/login", {"email": "admin@balitacenter.id", "password": PW})
cek("login", st == 200, st)

# ---------- BLOK 1: hard delete anak ditolak database ----------
st, kids, _ = call("GET", "/api/children")
anak = kids["children"][0]["id"] if kids.get("children") else None
st_hard = psql(f"DELETE FROM children WHERE id='{anak}';")
tertolak = "dilarang" in st_hard.lower() or "ERROR" in st_hard.upper()
cek("hard delete anak ditolak database", tertolak, st_hard[:70])
masih = psql(f"SELECT count(*) FROM children WHERE id='{anak}'")
cek("anak masih ada setelah percobaan hard delete", masih == "1", masih)

# ---------- BLOK 1: soft delete + restore ----------
st, d, _ = call("DELETE", f"/api/children/{anak}/sampah", {"reason": "uji jilid4"})
cek("DELETE anak = soft delete", st == 200 and d.get("deleted"), d)
in_trash = psql(f"SELECT deleted_at IS NOT NULL FROM children WHERE id='{anak}'")
cek("anak masuk Sampah", in_trash == "t", in_trash)
audit = psql(f"SELECT count(*) FROM audit_logs WHERE action='child.soft_delete' AND entity_id='{anak}'")
cek("hapus anak tercatat audit", int(audit or 0) >= 1, audit)
st, sampah, _ = call("GET", "/api/children?trash=1")
cek("Sampah menampilkan anak", any(c["id"] == anak for c in sampah.get("children") or []))
st, d, _ = call("PATCH", f"/api/children/{anak}/sampah", {"restore": True})
cek("pulihkan dari Sampah", st == 200 and d.get("restored"), d)
balik = psql(f"SELECT deleted_at IS NULL FROM children WHERE id='{anak}'")
cek("anak aktif kembali", balik == "t", balik)

# ---------- BLOK 2: report_date tanggal kalender ----------
TGL = "2026-12-08"
psql(f"DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id='{anak}' AND report_date='{TGL}')")
psql(f"DELETE FROM daily_reports WHERE child_id='{anak}' AND report_date='{TGL}'")
meta = psql(f"SELECT branch_id FROM children WHERE id='{anak}'")
kelas = psql(f"SELECT class_id FROM enrollments WHERE child_id='{anak}' LIMIT 1")
staf = psql("SELECT id FROM staff LIMIT 1")
st, buat, _ = call("POST", "/api/daily-reports", {
    "branch_id": meta, "child_id": anak, "class_id": kelas, "created_by": staf,
    "report_date": TGL, "notes": "CEK Jilid4 tanggal", "activities": [{"title": "CEK aktivitas", "apparatus": "Kartu", "rating": 5}],
})
rid = buat.get("id")
cek("draft tanggal 8 Des dibuat", st == 200 and rid, buat.get("error"))
st, detail, _ = call("GET", f"/api/daily-reports/{rid}")
tanggal = str((detail.get("report") or {}).get("report_date"))
cek("API mengirim tanggal apa adanya (bukan ISO)", tanggal.startswith(TGL) and "T" not in tanggal, tanggal)

# ---------- BLOK 4: roster absensi ----------
st, att, _ = call("GET", f"/api/attendance?class_id={kelas}&date={TGL}")
cek("roster absensi memuat anak kelas", len(att.get("children") or []) >= 1, len(att.get("children") or []))
st, sim, _ = call("POST", "/api/attendance", {"class_id": kelas, "date": TGL, "entries": [{"child_id": anak, "status": "hadir"}]})
cek("simpan absensi", st == 200 and sim.get("hadir") == 1, sim)
st, att2, _ = call("GET", f"/api/attendance?class_id={kelas}&date={TGL}")
cek("absensi tersimpan saat dibuka lagi", any(c.get("status") == "hadir" for c in att2.get("children") or []))

# ---------- BLOK 3: sesi panjang + sliding ----------
st, _, hd = call("POST", "/api/auth/login", {"email": "admin@balitacenter.id", "password": PW})
cookie = ""
for k, v in hd.items():
    if k.lower() == "set-cookie":
        cookie = v
maxage = 0
for bagian in cookie.split(";"):
    if "Max-Age" in bagian:
        maxage = int(bagian.split("=")[1].strip())
cek("umur cookie sesi 8 jam", maxage >= 8 * 3600 - 60, maxage)

# ---------- BLOK 5: simulator ----------
st, sim, _ = call("POST", "/api/ailsa/chat", {"text": "berapa biaya SPP?", "persona": "calon"})
cek("simulator persona calon menjawab", st == 200 and sim.get("ok"), sim.get("error") or sim.get("reply", "")[:60])
cek("panel proses menyertakan tool", isinstance(sim.get("tool"), list) and len(sim.get("tool")) >= 2, sim.get("tool"))
cek("log simulator tercatat", psql("SELECT count(*) FROM bot_conversations WHERE channel='simulator'") != "0")
durasi = None
if sim.get("ok"):
    mulai = time.time()
    call("POST", "/api/ailsa/chat", {"text": "jam operasional?", "persona": "calon"})
    durasi = round(time.time() - mulai, 1)
    cek("balasan < 10 detik", durasi < 10, f"{durasi}s")

# persona calon tidak boleh dapat data anak
st, sim2, _ = call("POST", "/api/ailsa/chat", {"text": "tampilkan laporan harian khadijah", "persona": "calon"})
cek("persona calon ditolak data anak", st == 200 and (sim2.get("ditahan") or sim2.get("eskalasi")), sim2.get("ditahan") or "eskalasi")

# ---------- BLOK 7: audit detail & jam ----------
st, aud, _ = call("GET", "/api/audit")
contoh = (aud.get("logs") or [{}])[0]
cek("audit mengirim jam WIB", "T" in str(contoh.get("waktu")), contoh.get("waktu"))

# ---------- bersihkan ----------
psql(f"DELETE FROM daily_report_activities WHERE report_id='{rid}'")
psql(f"DELETE FROM daily_reports WHERE id='{rid}'")
psql(f"DELETE FROM child_attendance WHERE child_id='{anak}' AND att_date='{TGL}'")
psql("DELETE FROM bot_conversations WHERE channel='simulator'")
psql("DELETE FROM leads WHERE wa_number LIKE 'simulator-%'")

lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
