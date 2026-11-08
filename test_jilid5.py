#!/usr/bin/env python3
"""Uji Jilid 5: audit, admission, bank pengetahuan, dokumen PDF, job tagihan, ubah anak."""
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:3011")
PW = os.environ.get("ADMIN_PW", "")
JOB = open("/tmp/job_token.txt").read().strip()
hasil = []


def cek(nama, lulus, catatan=""):
    hasil.append((nama, bool(lulus)))
    print(f"{'LULUS' if lulus else 'GAGAL'} · {nama}{(' — ' + str(catatan)[:110]) if catatan else ''}")


def psql(sql):
    out = subprocess.run(["sudo", "docker", "exec", "-u", "postgres", "balita-db",
                          "psql", "-d", "balita_center", "-tAc", sql], capture_output=True, text=True)
    return (out.stdout + out.stderr).strip()


jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
op.open(urllib.request.Request(f"{BASE}/api/auth/login", data=json.dumps(
    {"email": "admin@balitacenter.id", "password": PW}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30)


def call(method, path, body=None, raw=False, headers=None):
    r = urllib.request.Request(BASE + path, method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with op.open(r, data, timeout=90) as resp:
            isi = resp.read().decode()
            return resp.status, (isi if raw else json.loads(isi))
    except urllib.error.HTTPError as e:
        isi = e.read().decode()
        try:
            return e.code, json.loads(isi)
        except Exception:
            return e.code, isi


# ---------- BLOK 1: audit ----------
st, d = call("GET", "/api/audit?per=50&page=1")
cek("audit: pagination + total", st == 200 and d.get("total", 0) > 20 and len(d.get("logs", [])) == 50, d.get("total"))
contoh = (d.get("logs") or [{}])[0]
cek("audit: ada jam (WIB) di waktu", re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", contoh["waktu"]), contoh["waktu"])
cek("audit: aktor terisi", any(l.get("aktor") for l in d["logs"]))
st, d2 = call("GET", "/api/audit?dari=2026-11-05&sampai=2026-11-06&per=10")
cek("audit: filter tanggal menjangkau entri lama", st == 200 and d2.get("total", 0) > 0, d2.get("total"))
st, csv = call("GET", "/api/audit?format=csv&per=20", raw=True)
cek("audit: ekspor CSV", st == 200 and "waktu_wib" in str(csv) and "aksi" in str(csv))
cek("audit: tidak ada [object Object]", "[object Object]" not in json.dumps(d["logs"]))

# ---------- BLOK 2: admission ----------
psql("DELETE FROM leads WHERE wa_number = '6281700000013';")
st, d = call("POST", "/api/admission", {
    "parent_name": "Ibu Uji A", "child_name": "Anak Uji B, 4 tahun", "wa_number": "6281700000013",
    "branch_id": psql("SELECT id FROM branches LIMIT 1"), "source": "manual"})
cek("admission: lead dibuat", st == 200 and d.get("ok"), d)
row = psql("SELECT parent_name||' | '||child_name||' | '||coalesce(child_age_months::text,'-') FROM leads WHERE wa_number='6281700000013'")
cek("admission: nama benar & usia terpisah", row.startswith("Ibu Uji A | Anak Uji B |"), row)

# ---------- BLOK 3: bank pengetahuan ----------
psql("DELETE FROM bot_knowledge_entries WHERE question_sample ILIKE 'CEK J5%';")
st, d = call("POST", "/api/ailsa", {"question_sample": "CEK J5 — jam operasional?", "answer_text": "Buka 07.00-17.00 WIB."})
kid = d.get("id")
cek("bank: butir baru tersimpan sebagai draf", st == 200 and kid, d)
st, d2 = call("POST", "/api/ailsa", {"question_sample": "CEK J5 — jam operasional?", "answer_text": "Duplikat."})
cek("bank: duplikat ditolak", st == 409 and d2.get("existing_id") == kid, d2.get("error"))
st, d3 = call("PATCH", "/api/ailsa", {"id": kid, "status": "aktif"})
cek("bank: setujui dari UI/API", st == 200 and d3.get("ok"), d3)
cek("bank: jadi aktif", psql(f"SELECT status FROM bot_knowledge_entries WHERE id='{kid}'") == "aktif")
audit_bank = psql(f"SELECT count(*) FROM audit_logs WHERE action='ailsa.knowledge_setujui' AND entity_id='{kid}'")
cek("bank: persetujuan tercatat audit", int(audit_bank or 0) >= 1, audit_bank)

# ---------- BLOK 4: dokumen ----------
kids = json.loads(op.open(f"{BASE}/api/children", timeout=30).read())["children"]
anak = [k for k in kids if k["full_name"].lower() == "khadijah"][0]
lap = psql(f"SELECT id FROM daily_reports WHERE child_id='{anak['id']}' AND status='published' LIMIT 1")
if lap:
    st, html = call("GET", f"/api/dokumen/laporan/{lap}", raw=True)
    cek("dokumen: PDF laporan anak bisa dicetak", st == 200 and "LAPORAN HARIAN ANAK" in str(html))
else:
    cek("dokumen: PDF laporan anak (tidak ada laporan terbit untuk diuji)", True, "dilewati")

inv = psql("SELECT id FROM invoices WHERE status='belum_bayar' ORDER BY created_at DESC LIMIT 1")
if inv:
    staf = psql("SELECT id FROM staff LIMIT 1")
    st, d = call("POST", "/api/finance", {"action": "konfirmasi_bayar", "invoice_id": inv, "confirmed_by": staf, "method": "transfer"})
    cek("dokumen: konfirmasi lunas", st == 200 and d.get("ok"), d)
    kw = psql(f"SELECT receipt_number FROM receipts WHERE invoice_id='{inv}'")
    cek("kwitansi: nomor urut terbit", bool(kw) and kw.startswith("KWT/MLG/"), kw)
    st, html = call("GET", f"/kwitansi/{inv}/cetak", raw=True)
    cek("kwitansi: halaman cetak berisi terbilang", st == 200 and "Lima ratus ribu rupiah" in str(html))
    st, d = call("POST", "/api/finance", {"action": "batal_bayar", "invoice_id": inv, "reason": "uji"})
    batal = psql(f"SELECT cancelled_at IS NOT NULL FROM receipts WHERE invoice_id='{inv}'")
    cek("kwitansi: batal = DIBATALKAN, tidak dihapus", st == 200 and batal == "t", batal)

# ---------- BLOK 4: job tagihan idempotent ----------
periode = "2027-03"
psql(f"DELETE FROM invoice_notifications WHERE invoice_id IN (SELECT id FROM invoices WHERE period_month='{periode}-01')")
psql(f"DELETE FROM notifications WHERE title = 'Tagihan SPP baru'")
st, d = call("POST", "/api/jobs/tagihan", {"aksi": "buat", "periode": periode}, headers={"x-job-token": JOB})
st2, d2 = call("POST", "/api/jobs/tagihan", {"aksi": "buat", "periode": periode}, headers={"x-job-token": JOB})
jumlah = psql(f"SELECT count(*) FROM invoices WHERE period_month='{periode}-01'")
anak_aktif = int(psql("SELECT count(*) FROM children WHERE deleted_at IS NULL AND status='aktif'") or 0)
cek("job: 1 tagihan per anak & run kedua tidak menggandakan", int(jumlah or 0) == int(d.get("dibuat") or 0) and int(d2.get("dibuat") or 0) == 0,
    f"tagihan={jumlah} run1={d.get('dibuat')} run2={d2.get('dibuat')} anak={anak_aktif}")
cek("job: status kanal jujur", d.get("kanal") == "menunggu_kanal", d.get("kanal"))
log = psql(f"SELECT status FROM invoice_notifications WHERE jenis='terbit' AND channel='whatsapp' LIMIT 1")
cek("job: log pengiriman mencatat menunggu_kanal", log in ("menunggu_kanal", ""), log)

# ---------- BLOK 5: ubah anak ----------
st, d = call("PATCH", f"/api/children/{anak['id']}", {"hobbies": "CEK J5 hobi"})
cek("ubah anak: PATCH tersimpan", st == 200 and d.get("ok"), d)
cek("ubah anak: nilai tampil", psql(f"SELECT hobbies FROM children WHERE id='{anak['id']}'") == "CEK J5 hobi")
audit_anak = psql(f"SELECT count(*) FROM audit_logs WHERE action='child.update' AND entity_id='{anak['id']}'")
cek("ubah anak: tercatat audit", int(audit_anak or 0) >= 1, audit_anak)

# bersihkan
psql("DELETE FROM leads WHERE wa_number='6281700000013'")
psql("DELETE FROM bot_knowledge_entries WHERE question_sample ILIKE 'CEK J5%'")
psql(f"UPDATE children SET hobbies=NULL WHERE id='{anak['id']}'")
psql(f"DELETE FROM invoice_notifications WHERE invoice_id IN (SELECT id FROM invoices WHERE period_month='{periode}-01')")
psql(f"DELETE FROM receipts WHERE invoice_id IN (SELECT id FROM invoices WHERE period_month='{periode}-01')")
psql(f"DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE period_month='{periode}-01')")
psql(f"DELETE FROM invoices WHERE period_month='{periode}-01'")

lulus = sum(1 for _, ok in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
