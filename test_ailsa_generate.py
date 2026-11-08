#!/usr/bin/env python3
"""Uji Ailsa menghasilkan draf laporan harian & analisa perkembangan."""
import json
import os
import subprocess
import sys
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
    return out.stdout.strip()


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
        with urllib.request.urlopen(r, data, timeout=180) as resp:
            for k, v in resp.headers.items():
                if k.lower() == "set-cookie":
                    jar["cookie"] = v.split(";")[0]
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


st, d = call("POST", "/api/auth/login", {"email": "admin@balitacenter.id", "password": PW})
cek("login admin", st == 200, st)

anak = psql("SELECT id FROM children WHERE full_name='khadijah' AND deleted_at IS NULL LIMIT 1")
branch = psql(f"SELECT branch_id FROM children WHERE id='{anak}'")
kelas = psql(f"SELECT id FROM classes WHERE branch_id='{branch}' AND deleted_at IS NULL LIMIT 1")
staf = psql("SELECT id FROM staff LIMIT 1")
TGL = "2026-10-20"

# ---------- 1) DRAF LAPORAN HARIAN ----------
psql(f"DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id='{anak}' AND report_date='{TGL}')")
psql(f"DELETE FROM daily_reports WHERE child_id='{anak}' AND report_date='{TGL}'")

st, d = call("POST", "/api/ailsa/generate", {"action": "draft_laporan", "child_id": anak, "tanggal": TGL})
cek("draf tanpa catatan ditolak", st == 400 and not d.get("ok"), d.get("error"))

st, d = call("POST", "/api/ailsa/generate", {
    "action": "draft_laporan", "child_id": anak, "tanggal": TGL,
    "catatan": "Hari ini bermain kartu warna, menyebut tiga warna. Makan nasi ayam habis. Tidur 40 menit. Pipis 3 kali. Ceria sepanjang hari.",
})
cek("draf laporan dibuat", st == 200 and d.get("ok") and d.get("id"), d.get("error"))
rid = d.get("id")

if rid:
    status = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
    cek("draf berstatus draft (tidak terbit sendiri)", status == "draft", status)
    akt = psql(f"SELECT count(*) FROM daily_report_activities WHERE report_id='{rid}'")
    cek("draf punya aktivitas", int(akt or 0) >= 1, akt)
    isi = psql(f"SELECT coalesce(mood,'-')||'|'||coalesce(notes,'-') FROM daily_reports WHERE id='{rid}'")
    cek("draf terisi mood & catatan", "|" in isi and len(isi) > 3, isi[:90])
    cetak = psql(f"SELECT string_agg(title, '; ') FROM daily_report_activities WHERE report_id='{rid}'")
    cek("aktivitas berupa judul nyata (bukan kosong)", bool(cetak), cetak[:80])
    medis = psql(f"SELECT count(*) FROM daily_reports WHERE id='{rid}' AND (notes ILIKE '%autis%' OR notes ILIKE '%adhd%' OR notes ILIKE '%gangguan%')")
    cek("tanpa istilah diagnosis", medis == "0")
    psql(f"DELETE FROM daily_report_activities WHERE report_id='{rid}'")
    psql(f"DELETE FROM daily_reports WHERE id='{rid}'")

# ---------- 2) ANALISA: data tipis harus menolak ----------
psql(f"DELETE FROM ailsa_analyses WHERE child_id='{anak}'")
# periode yang dijamin kosong, bukan periode yang dipakai uji berikutnya
st, d = call("POST", "/api/ailsa/generate", {"action": "analisa", "child_id": anak, "dari": "2025-03-01", "sampai": "2025-03-31"})
cek("analisa menolak bila laporan < 3", st == 400 and "belum cukup" in (d.get("error") or "").lower(), d.get("error"))

# ---------- 3) ANALISA dengan 3 laporan terbit ----------
dibuat = []
for bersih in ["2026-09-10", "2026-09-17", "2026-09-24"]:
    psql(f"DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE report_date='{bersih}' AND child_id='{anak}')")
    psql(f"DELETE FROM daily_reports WHERE report_date='{bersih}' AND child_id='{anak}'")
for i, tgl in enumerate(["2026-09-10", "2026-09-17", "2026-09-24"]):
    psql(f"DELETE FROM daily_reports WHERE child_id='{anak}' AND report_date='{tgl}'")
    rid2 = psql(
        f"INSERT INTO daily_reports (branch_id, child_id, class_id, created_by, report_date, mood, notes,"
        f" meal_level, snack_level, nap_quality, status, lead_facilitator_id)"
        f" VALUES ('{branch}','{anak}','{kelas}','{staf}','{tgl}','ceria',"
        f"'RETEST analisa: bermain kartu warna dan menyebut warna', 'banyak','banyak','baik','published','{staf}')"
        f" RETURNING id")
    psql(f"INSERT INTO daily_report_activities (report_id, title, apparatus, rating, sort_order)"
         f" VALUES ('{rid2}','RETEST bermain kartu warna','Kartu warna',{4 + i % 2},0)")
    dibuat.append(rid2)

st, d = call("POST", "/api/ailsa/generate", {"action": "analisa", "child_id": anak, "dari": "2026-09-01", "sampai": "2026-09-30"})
cek("analisa dibuat dari 3 laporan terbit", st == 200 and d.get("ok"), d.get("error") or d.get("ditahan"))
if d.get("ok"):
    isi = d.get("data") or {}
    cek("analisa menyebut dasar jumlah laporan", "3" in json.dumps(isi.get("ringkasan", "")), (isi.get("ringkasan") or "")[:80])
    cek("analisa punya aspek", isinstance(isi.get("aspects"), list) and len(isi.get("aspects")) >= 1, len(isi.get("aspects") or []))
    simpan = psql(f"SELECT published_count FROM ailsa_analyses WHERE child_id='{anak}' ORDER BY created_at DESC LIMIT 1")
    cek("artefak tersimpan dengan jumlah laporan", simpan == "3", simpan)
    teks = json.dumps(isi).lower()
    cek("tanpa label diagnosis", not any(k in teks for k in ["autis", "adhd", "gangguan", "kelainan"]))
    st2, d2 = call("GET", f"/api/ailsa/generate?child_id={anak}")
    cek("analisa tampil di daftar", st2 == 200 and len(d2.get("analyses") or []) >= 1, len(d2.get("analyses") or []))

# bersihkan
for rid3 in dibuat:
    psql(f"DELETE FROM daily_report_activities WHERE report_id='{rid3}'")
    psql(f"DELETE FROM daily_reports WHERE id='{rid3}'")
psql(f"DELETE FROM ailsa_analyses WHERE child_id='{anak}'")

lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
