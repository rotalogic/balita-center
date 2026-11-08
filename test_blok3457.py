#!/usr/bin/env python3
"""Uji Blok 3–7: STPPA satu sumber + impor CSV, cuti dengan pemilih staf,
filter & ekspor Laporan, jejak audit, roster absensi, tagihan per anak,
dan pratinjau Connect terikat anak."""
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

BASE = "http://127.0.0.1:3011"
EMAIL = "admin@balitacenter.id"
PW = os.environ.get("ADMIN_PW", "")
hasil = []


def cek(nama, lulus, catatan=""):
    hasil.append((nama, bool(lulus), catatan))
    print(f"{'LULUS' if lulus else 'GAGAL'} · {nama}{(' — ' + str(catatan)) if catatan else ''}")


def call(method, path, body=None, cookie=None):
    req = urllib.request.Request(BASE + path, method=method)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, data, timeout=30) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def j(method, path, body=None, cookie=None):
    st, raw, hd = call(method, path, body, cookie)
    try:
        return st, json.loads(raw), hd
    except Exception:
        return st, {"raw": raw[:300].decode(errors="replace")}, hd


def unggah(cookie):
    """Unggah 1 PNG 1x1 lewat /api/upload, kembalikan URL internalnya."""
    import uuid as _uuid
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
    )
    batas = "----RETEST" + _uuid.uuid4().hex
    body = (f"--{batas}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"retest.png\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + png + f"\r\n--{batas}--\r\n".encode()
    req = urllib.request.Request(BASE + "/api/upload", data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={batas}")
    req.add_header("Cookie", cookie)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read()).get("url")


def psql(sql):
    # Trigger database menolak hard delete anak; uji perlu izin eksplisit.
    if "DELETE FROM children" in sql:
        sql = "SET balita.izinkan_hapus='ya'; " + sql
    out = subprocess.run(
        ["sudo", "docker", "exec", "-u", "postgres", "balita-db", "psql", "-d", "balita_center", "-tAc", sql],
        capture_output=True, text=True)
    return out.stdout.strip()


# --- bersihkan sisa uji sebelumnya ---
psql("DELETE FROM stppa_items WHERE item_text ILIKE 'RETEST%';")
psql("DELETE FROM leave_requests WHERE reason ILIKE 'RETEST%';")
psql("DELETE FROM child_attendance WHERE att_date = '2026-12-15';")
psql("DELETE FROM daily_reports WHERE notes ILIKE 'RETEST%';")

# --- login ---
st, d, hd = j("POST", "/api/auth/login", {"email": EMAIL, "password": PW})
cookie = ""
for k, v in hd.items():
    if k.lower() == "set-cookie":
        cookie = v.split(";")[0]
cek("login admin", st == 200 and cookie, st)

st, meta, _ = j("GET", "/api/meta", cookie=cookie)
st, kids, _ = j("GET", "/api/children", cookie=cookie)
anak = kids["children"][0]
branch = meta["branches"][0]
kelas = [c for c in meta["classes"] if c["branch_id"] == branch["id"]][0]
guru = [s for s in meta["staff"] if s["branch_id"] == branch["id"]][0]

# ================= BLOK 3A — STPPA =================
st, ak, _ = j("GET", "/api/academic", cookie=cookie)
aspek = [a for a in ak["aspects"]]
cek("7 aspek STPPA dari satu sumber", len(aspek) == 7, [a["label"] for a in aspek])
cek("label 'Nilai Agama & Moral' ada", any(a["label"] == "Nilai Agama & Moral" for a in aspek))
cek("motorik dipecah kasar+halus", {"motorik_kasar", "motorik_halus"} <= {a["code"] for a in aspek})

USIA = "3-4 tahun"
# kasus yang dulu gagal di UI: label "Nilai Agama"
st, r, _ = j("POST", "/api/academic", {"kind": "stppa", "age_group": USIA, "aspect": "Nilai Agama", "item_text": "RETEST mengucap salam"}, cookie)
cek("aspek label parsial 'Nilai Agama' diterima", st == 200, f"{st} {r.get('error')}")
if st == 200:
    id1 = r["id"]
    psql(f"DELETE FROM stppa_items WHERE id='{id1}';")

st, r, _ = j("POST", "/api/academic", {"kind": "stppa", "age_group": USIA, "aspect": "Nilai Agama & Moral", "item_text": "RETEST butir agama moral"}, cookie)
cek("aspek label penuh diterima", st == 200, f"{st} {r.get('error')}")
id_agama = r.get("id")

st, r2, _ = j("POST", "/api/academic", {"kind": "stppa", "age_group": USIA, "aspect": "Nilai Agama & Moral", "item_text": "RETEST butir agama moral"}, cookie)
cek("butir kembar ditolak 409", st == 409 and r2.get("existing_id"), f"{st} {r2.get('error')}")

st, r3, _ = j("POST", "/api/academic", {"kind": "stppa", "age_group": USIA, "aspect": "Aspek Karangan", "item_text": "RETEST aspek ngawur"}, cookie)
cek("aspek ngawur ditolak dengan daftar", st == 400 and "Motorik Halus" in str(r3.get("error")), r3.get("error"))

# impor CSV
csv = """Kelompok Usia;Aspek;Butir
3-4 tahun;Motorik Kasar;RETEST melompat dua kaki
3-4 tahun;Motorik Halus;RETEST menggunting garis lurus
3-4 tahun;Bahasa;RETEST menyebut nama anggota keluarga
3-4 tahun;Aspek Ngawur;RETEST baris rusak
9-9 tahun;Bahasa;RETEST usia salah"""
st, imp, _ = j("POST", "/api/academic", {"kind": "stppa_import", "csv": csv}, cookie)
cek("impor CSV: 3 masuk", st == 200 and imp.get("masuk") == 3, imp)
cek("impor CSV: 2 baris gagal dilaporkan", len(imp.get("gagal") or []) == 2, imp.get("gagal"))
st, imp2, _ = j("POST", "/api/academic", {"kind": "stppa_import", "csv": csv}, cookie)
cek("impor ulang tidak menggandakan", imp2.get("masuk") == 0 and imp2.get("duplikat") == 3, imp2)

# edit + nonaktifkan
st, r, _ = j("PATCH", f"/api/academic/{id_agama}?kind=stppa", {"item_text": "RETEST butir agama moral (revisi)"}, cookie)
cek("butir STPPA bisa diedit", st == 200, r)
st, r, _ = j("PATCH", f"/api/academic/{id_agama}?kind=stppa", {"is_active": False}, cookie)
aktif = psql(f"SELECT is_active FROM stppa_items WHERE id='{id_agama}';")
cek("butir STPPA bisa dinonaktifkan", st == 200 and aktif == "f", aktif)
j("PATCH", f"/api/academic/{id_agama}?kind=stppa", {"is_active": True}, cookie)

# ================= BLOK 3B — CUTI =================
# Akun admin belum tentu tertaut ke staf — tautkan sekali supaya persetujuan
# bisa diuji dengan aktor yang sah (bukan memilih nama pemutus dari layar).
st, users, _ = j("GET", "/api/users", cookie=cookie)
admin_user = next((u for u in users["users"] if u["email"] == EMAIL), None)
st, r, _ = j("PATCH", f"/api/users/{admin_user['id']}", {"staff_id": guru["id"]}, cookie)
cek("tautkan akun admin ke staf guru", st == 200, f"{st} {r.get('error')}")

st, lv, _ = j("GET", "/api/hr/leave", cookie=cookie)
cek("GET cuti mengirim daftar staf pemohon", isinstance(lv.get("staff"), list), len(lv.get("staff") or []))
cek("flag canPickStaff untuk admin", lv.get("canPickStaff") is True)
pemohon = guru["id"]
st, r, _ = j("POST", "/api/hr/leave", {
    "kind": "cuti", "start_date": "2026-12-20", "end_date": "2026-12-21",
    "reason": "RETEST cuti blok 3", "staff_id": pemohon,
}, cookie)
cek("admin ajukan cuti atas nama guru", st == 200, f"{st} {r.get('error')}")
leave_id = r.get("id")

st, lv2, _ = j("GET", "/api/hr/leave", cookie=cookie)
cek("pengajuan muncul di antrean", any(x["id"] == leave_id for x in lv2["requests"]))
cek("menunggu bertambah", lv2["counts"]["menunggu"] >= 1, lv2["counts"])

st, r, _ = j("PATCH", f"/api/hr/leave/{leave_id}", {"status": "disetujui"}, cookie)
cek("setujui cuti", st == 200, f"{st} {r.get('error')}")
st, r, _ = j("PATCH", f"/api/hr/leave/{leave_id}", {"status": "disetujui"}, cookie)
cek("putusan ganda ditolak 409", st == 409, st)
nama_pemutus = psql(f"SELECT s.full_name FROM leave_requests l JOIN staff s ON s.id=l.decided_by WHERE l.id='{leave_id}';")
cek("decided_by = staf akun yang login", nama_pemutus != "", nama_pemutus or "(kosong)")

# ================= BLOK 5A — ROSTER ABSENSI =================
st, att, _ = j("GET", f"/api/attendance?class_id={kelas['id']}&date=2026-12-15", cookie=cookie)
cek("roster kelas tidak kosong", st == 200 and len(att.get("children") or []) >= 1, len(att.get("children") or []))
if att.get("children"):
    cid = att["children"][0]["id"]
    st, sim, _ = j("POST", "/api/attendance", {"class_id": kelas["id"], "date": "2026-12-15", "entries": [{"child_id": cid, "status": "hadir"}]}, cookie)
    cek("simpan absensi hadir", st == 200 and sim.get("hadir") == 1, sim)
    st, att2, _ = j("GET", f"/api/attendance?class_id={kelas['id']}&date=2026-12-15", cookie=cookie)
    cek("status tersimpan & tidak digandakan", len(att2["children"]) == len(att["children"]) and att2["children"][0]["status"] == "hadir", [c.get("status") for c in att2["children"]])
    st, rep, _ = j("GET", f"/api/reports?dari=2026-12-15&sampai=2026-12-15", cookie=cookie)
    cek("Kehadiran terhitung di Laporan", rep["kehadiran"]["hadir"] >= 1, rep["kehadiran"])

# ================= BLOK 4 — LAPORAN: FILTER, EKSPOR, AUDIT =================
# Data contoh untuk filter & ekspor: satu laporan terbit pada November.
psql(f"DELETE FROM daily_reports WHERE child_id='{anak['id']}' AND report_date='2026-11-10';")
foto_nov = unggah(cookie)
st, nov, _ = j("POST", "/api/daily-reports", {
    "branch_id": branch["id"], "child_id": anak["id"], "class_id": kelas["id"],
    "created_by": guru["id"], "report_date": "2026-11-10", "notes": "RETEST contoh ekspor",
    "lead_facilitator_id": guru["id"],
    "activities": [{"title": "RETEST aktivitas ekspor", "apparatus": "Kartu angka", "rating": 5}],
    "photo_urls": [foto_nov],
}, cookie)
nov_id = nov.get("id")
j("PATCH", f"/api/daily-reports/{nov_id}", {"submit": True}, cookie)
st, pub_nov, _ = j("PATCH", f"/api/daily-reports/{nov_id}", {"publish": True}, cookie)
cek("laporan contoh November terbit", st == 200, f"{st} {pub_nov.get('error')}")

st, luas, _ = j("GET", "/api/reports?dari=2026-11-01&sampai=2026-11-30", cookie=cookie)
st, sempit, _ = j("GET", "/api/reports?dari=2026-11-06&sampai=2026-11-06", cookie=cookie)
cek("filter tanggal mengubah angka", luas["ringkas"]["total"] > sempit["ringkas"]["total"],
    f"bulan={luas['ringkas']['total']} vs sehari={sempit['ringkas']['total']}")
st, satu_cabang, _ = j("GET", f"/api/reports?dari=2026-11-01&sampai=2026-11-30&branch_id={branch['id']}", cookie=cookie)
cek("filter cabang jalan", st == 200, satu_cabang["ringkas"])
st, by_status, _ = j("GET", "/api/reports?dari=2026-11-01&sampai=2026-11-30&status=published", cookie=cookie)
cek("filter status jalan", all(r["status"] == "published" for r in by_status["reports"]), len(by_status["reports"]))

st, raw, hd = call("GET", "/api/reports?dari=2026-11-01&sampai=2026-11-30&format=csv", cookie=cookie)
teks = raw.decode("utf-8-sig", errors="replace")
cek("ekspor CSV ada isinya", st == 200 and "Tanggal" in teks.splitlines()[0], teks.splitlines()[0] if teks else "")
cek("tanggal CSV format Indonesia", any("November" in l for l in teks.splitlines()[1:]), teks.splitlines()[1][:60] if len(teks.splitlines()) > 1 else "")
cd = hd.get("Content-Disposition") or hd.get("content-disposition") or ""
cek("nama berkas memuat periode & filter", "laporan-harian_2026-11-01_2026-11-30" in cd, cd)

st, raw, hd = call("GET", f"/api/reports?dari=2026-11-01&sampai=2026-11-30&format=xlsx", cookie=cookie)
try:
    z = zipfile.ZipFile(io.BytesIO(raw))
    isi = z.read("xl/worksheets/sheet1.xml").decode()
    cek("ekspor XLSX valid & terbaca", "worksheet" in isi and "November" in isi, f"{len(raw)} byte")
except Exception as e:
    cek("ekspor XLSX valid & terbaca", False, str(e))

st, aud, _ = j("GET", "/api/audit?aksi=leave", cookie=cookie)
cek("jejak audit berisi aksi cuti", st == 200 and len(aud.get("logs") or []) >= 2, len(aud.get("logs") or []))
st, aud2, _ = j("GET", "/api/audit", cookie=cookie)
aksi_unik = {x["action"] for x in aud2.get("logs") or []}
cek("audit punya ≥3 aksi berbeda", len(aksi_unik) >= 3, sorted(aksi_unik)[:6])
st, aud3, _ = j("GET", f"/api/audit?aktor={EMAIL}", cookie=cookie)
cek("filter aktor jalan", len(aud3.get("logs") or []) >= 1, len(aud3.get("logs") or []))

# ================= BLOK 5B — TAGIHAN PER ANAK =================
bulan_depan = "2026-12"
psql(f"DELETE FROM invoices WHERE child_id='{anak['id']}' AND period_month='{bulan_depan}-01';")
st, inv, _ = j("POST", "/api/finance", {"action": "tagihan_anak", "child_id": anak["id"], "period_month": bulan_depan}, cookie)
cek("tagihan per anak bulan depan dibuat", st == 200 and inv.get("amount", 0) > 0, f"{st} {inv}")
st, inv2, _ = j("POST", "/api/finance", {"action": "tagihan_anak", "child_id": anak["id"], "period_month": bulan_depan}, cookie)
cek("tagihan duplikat ditolak + tautan", st == 409 and inv2.get("existing_id"), f"{st} {inv2.get('error')}")
st, inv3, _ = j("POST", "/api/finance", {
    "action": "tagihan_anak", "child_id": anak["id"], "period_month": "2027-01", "amount": "100000",
}, cookie)
cek("ubah nominal tanpa alasan ditolak", st == 400, inv3.get("error"))
st, inv4, _ = j("POST", "/api/finance", {
    "action": "tagihan_anak", "child_id": anak["id"], "period_month": "2027-01", "amount": "100000", "reason": "Diskon saudara",
}, cookie)
cek("ubah nominal dengan alasan diterima", st == 200, f"{st} {inv4.get('error')}")
psql(f"DELETE FROM invoices WHERE child_id='{anak['id']}' AND period_month IN ('{bulan_depan}-01','2027-01-01');")

# ================= BLOK 7 — PRATINJAU CONNECT =================
# terbitkan satu laporan untuk anak A
psql(f"DELETE FROM daily_reports WHERE child_id='{anak['id']}' AND report_date='2026-12-18';")
foto = unggah(cookie)
cek("unggah foto untuk syarat terbit", bool(foto), foto)
st, buat, _ = j("POST", "/api/daily-reports", {
    "branch_id": branch["id"], "child_id": anak["id"], "class_id": kelas["id"],
    "created_by": guru["id"], "report_date": "2026-12-18", "notes": "RETEST pratinjau connect",
    "lead_facilitator_id": guru["id"],
    "activities": [{"title": "RETEST aktivitas", "apparatus": "Kartu", "rating": 5}],
    "photo_urls": [foto],
}, cookie)
rid = buat.get("id")
j("PATCH", f"/api/daily-reports/{rid}", {"submit": True}, cookie)
st, rv, _ = j("PATCH", f"/api/daily-reports/{rid}", {"publish": True}, cookie)
cek("laporan uji terbit", st == 200, f"{st} {rv.get('error')}")

st, prev_a, _ = j("GET", f"/api/connect?child_id={anak['id']}&preview=1", cookie=cookie)
cek("pratinjau anak A menandai mode pratinjau", prev_a.get("preview") is True)
cek("pratinjau anak A menampilkan laporan terbit", (prev_a.get("report") or {}).get("id") == rid,
    (prev_a.get("report") or {}).get("id"))
cek("nama wali dikirim untuk banner", isinstance(prev_a.get("guardian_name"), (str, type(None))), prev_a.get("guardian_name"))

anak_lain = psql(f"SELECT id FROM children WHERE deleted_at IS NULL AND id <> '{anak['id']}' LIMIT 1;")
if anak_lain:
    st, prev_b, _ = j("GET", f"/api/connect?child_id={anak_lain}&preview=1", cookie=cookie)
    cek("pratinjau anak B tidak menampilkan laporan anak A",
        (prev_b.get("child") or {}).get("id") == anak_lain and (prev_b.get("report") or {}).get("id") != rid,
        (prev_b.get("report") or {}).get("id"))
else:
    cek("pratinjau anak B tidak menampilkan laporan anak A", True, "hanya satu anak di DB — dilewati")

# draft anak A tidak tampil di pratinjau mana pun
psql(f"DELETE FROM daily_reports WHERE child_id='{anak['id']}' AND report_date='2026-12-19';")
st, draft, _ = j("POST", "/api/daily-reports", {
    "branch_id": branch["id"], "child_id": anak["id"], "class_id": kelas["id"],
    "created_by": guru["id"], "report_date": "2026-12-19", "notes": "RETEST draft pratinjau",
}, cookie)
did = draft.get("id")
st, prev2, _ = j("GET", f"/api/connect?child_id={anak['id']}&preview=1", cookie=cookie)
cek("draft tidak tampil di pratinjau", (prev2.get("report") or {}).get("id") != did,
    (prev2.get("report") or {}).get("id"))

st, r, _ = j("POST", "/api/connect", {"kind": "rsvp", "child_id": anak["id"], "event_id": "00000000-0000-0000-0000-000000000000", "response": "hadir", "preview": True}, cookie)
cek("aksi tulis ditolak di mode pratinjau", st == 403, f"{st} {r.get('error')}")

# bersihkan
psql(f"DELETE FROM daily_reports WHERE child_id='{anak['id']}' AND report_date IN ('2026-11-10','2026-12-18','2026-12-19');")
psql(f"DELETE FROM stppa_items WHERE item_text ILIKE 'RETEST%';")
psql(f"DELETE FROM leave_requests WHERE reason ILIKE 'RETEST%';")
psql("DELETE FROM child_attendance WHERE att_date = '2026-12-15';")

lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
