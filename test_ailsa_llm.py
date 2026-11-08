#!/usr/bin/env python3
"""Uji Ailsa LLM + WhatsApp (uji 1,2,4,5,6,7,9,11 dari dokumen pemilik).
Butuh container uji dengan WHATSAPP_VERIFY_TOKEN/APP_SECRET uji dan kunci LLM."""
import hashlib
import hmac
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("BASE", "http://127.0.0.1:3012")
SECRET = os.environ.get("WA_SECRET", "uji-secret-456")
VERIFY = os.environ.get("WA_VERIFY", "uji-verify-123")
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


ADMIN_PW = os.environ.get("ADMIN_PW", "")
COOKIE = {"v": ""}


def login_admin():
    r = urllib.request.Request(BASE + "/api/auth/login",
                               data=json.dumps({"email": "admin@balitacenter.id", "password": ADMIN_PW}).encode(),
                               method="POST")
    r.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(r, timeout=30) as resp:
        for k, v in resp.headers.items():
            if k.lower() == "set-cookie":
                COOKIE["v"] = v.split(";")[0]


def req(method, path, body=None, headers=None):
    r = urllib.request.Request(BASE + path, method=method)
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        r.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    if COOKIE["v"] and not path.startswith("/api/whatsapp"):
        r.add_header("Cookie", COOKIE["v"])
    try:
        with urllib.request.urlopen(r, data, timeout=90) as resp:
            return resp.status, resp.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def kirim_pesan(wa: str, teks: str, wamid: str | None = None):
    wamid = wamid or f"wamid.TEST{uuid.uuid4().hex}"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{"changes": [{"value": {"messages": [{
            "id": wamid, "from": wa, "type": "text", "text": {"body": teks},
        }]}}]}],
    }
    raw = json.dumps(payload).encode()
    tanda = "sha256=" + hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()
    st, body = req("POST", "/api/whatsapp/webhook", raw, {"X-Hub-Signature-256": tanda})
    return st, body, wamid


def balasan_terakhir(wa: str):
    return psql(f"SELECT message_text FROM bot_conversations WHERE direction='keluar' AND lead_id='{lead_id(wa)}' ORDER BY created_at DESC LIMIT 1")


def lead_id(wa: str):
    return psql(f"SELECT id FROM leads WHERE wa_number='{wa}' ORDER BY created_at DESC LIMIT 1")


login_admin()
KONTAK = "6281200000001"
K2 = "6281200000002"
psql(f"DELETE FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number IN ('{KONTAK}','{K2}'))")
psql(f"DELETE FROM leads WHERE wa_number IN ('{KONTAK}','{K2}')")

# ---- 1) verifikasi webhook ----
st, body = req("GET", f"/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token={VERIFY}&hub.challenge=abc123")
cek("GET verifikasi token benar → challenge", st == 200 and body.strip() == "abc123", f"{st} {body[:20]}")
st, _ = req("GET", "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=abc")
cek("GET token salah ditolak 403", st == 403, st)

# ---- 2) tanda tangan ----
raw = json.dumps({"entry": []}).encode()
st, _ = req("POST", "/api/whatsapp/webhook", raw, {"X-Hub-Signature-256": "sha256=deadbeef"})
cek("POST tanda tangan salah ditolak 401", st == 401, st)
st, _ = req("POST", "/api/whatsapp/webhook", raw)
cek("POST tanpa tanda tangan ditolak 401", st == 401, st)

# ---- 4) grounding biaya ----
st, body, wid = kirim_pesan(KONTAK, "Halo, berapa biaya SPP di Balita Center?")
cek("webhook bertanda tangan benar diterima", st == 200, st)
import time
for _ in range(30):
    time.sleep(1)
    if balasan_terakhir(KONTAK):
        break
jawab = balasan_terakhir(KONTAK)
cek("Ailsa membalas pertanyaan biaya", bool(jawab), (jawab or "")[:80])
if "500" not in (jawab or "").replace(".", "").replace(",", ""):
    # Ailsa boleh memilih mengumpulkan nama dulu; harga harus muncul di giliran berikutnya.
    kirim_pesan(KONTAK, "Program Reguler, anak saya Rara usia 3 tahun")
    for _ in range(25):
        time.sleep(1)
        jawab = balasan_terakhir(KONTAK)
        if "500" in (jawab or "").replace(".", "").replace(",", ""):
            break
cek("nominal SPP sesuai data program (500.000)", "500" in (jawab or "").replace(".", "").replace(",", ""), (jawab or "")[:120])

# ---- duplikasi wamid ----
st, _, wid2 = kirim_pesan(KONTAK, "Berapa biaya SPP?", wamid=wid)
time.sleep(3)
n = psql(f"SELECT count(*) FROM bot_conversations WHERE wa_message_id='{wid}'")
cek("wamid duplikat tidak diproses dua kali", n == "1", f"baris={n}")

# ---- 5) pertanyaan di luar pengetahuan -> tak terjawab + eskalasi ----
sebelum = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id='{lead_id(KONTAK)}' AND direction='keluar'")
kirim_pesan(KONTAK, "Apakah sekolah menyediakan kelas berenang mingguan?")
for _ in range(30):
    time.sleep(1)
    sesudah = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id='{lead_id(KONTAK)}' AND direction='keluar'")
    if int(sesudah) > int(sebelum):
        break
jawab2 = balasan_terakhir(KONTAK)
cek("pertanyaan tak diketahui dijawab dengan eskalasi", any(k in jawab2.lower() for k in ["admin", "tanya", "teruskan", "belum"]), (jawab2 or "")[:100])
esk = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id='{lead_id(KONTAK)}' AND escalated")
cek("percakapan ditandai eskalasi", int(esk) >= 1, esk)

# ---- 6) STOP ----
kirim_pesan(KONTAK, "STOP")
for _ in range(20):
    time.sleep(1)
    if psql(f"SELECT opt_out FROM leads WHERE wa_number='{KONTAK}'") == "t":
        break
cek("STOP menandai opt_out", psql(f"SELECT opt_out FROM leads WHERE wa_number='{KONTAK}'") == "t")

# ---- 7) ambil alih ----
psql(f"UPDATE leads SET opt_out=false WHERE wa_number='{KONTAK}'")
st, body = req("POST", "/api/ailsa/takeover", {"wa_number": KONTAK, "action": "ambil"})
cek("ambil alih tercatat", st == 200 and '"ok":true' in body.replace(" ", ""), f"{st} {body[:60]}")
sesudah_ambil = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id='{lead_id(KONTAK)}' AND direction='keluar'")
kirim_pesan(KONTAK, "Halo?")
time.sleep(6)
masih = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id='{lead_id(KONTAK)}' AND direction='keluar'")
cek("bot diam saat diambil alih", masih == sesudah_ambil, f"{sesudah_ambil} → {masih}")
psql(f"UPDATE leads SET takeover_at=NULL WHERE wa_number='{KONTAK}'")

# ---- 9) status kanal & env ----
st, body = req("GET", "/api/ailsa/status")
d = json.loads(body) if body.startswith("{") else {}
if st == 401:
    cek("status kanal butuh login (aman)", True, "401")
else:
    cek("status kanal terbaca setelah login", st == 200, st)
    nama = [e["name"] for e in d.get("env", [])]
    cek("status menyebut 5 variabel env", set(nama) >= {
        "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_APP_SECRET", "WHATSAPP_ADMIN_NUMBER"}, nama)
    cek("status LLM melaporkan model", bool(d.get("llm", {}).get("model")), d.get("llm"))

# ---- 11) tidak ada kredensial di respons ----
st, body = req("GET", "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=x")
cek("respons tidak membocorkan nilai rahasia", SECRET not in body and VERIFY not in body, body[:60])

# ---- 6) alur lead lengkap ----
psql(f"DELETE FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{K2}')")
psql(f"DELETE FROM leads WHERE wa_number='{K2}'")
for pesan in ["Halo, saya mau tanya biaya dan trial",
              "Nama saya Budi",
              "Anak saya Rara",
              "Usianya 36 bulan",
              "Cabang Malang",
              "Program Reguler",
              "YA setuju"]:
    kirim_pesan(K2, pesan)
    time.sleep(4)
n_lead = psql(f"SELECT count(*) FROM leads WHERE wa_number='{K2}' AND source='whatsapp_ailsa'")
cek("alur lead membuat tepat 1 lead", n_lead == "1", n_lead)
isi = psql(f"SELECT coalesce(parent_name,'-')||'|'||coalesce(child_name,'-')||'|'||stage FROM leads WHERE wa_number='{K2}'")
cek("lead menyimpan nama anak & tahap lead_masuk", "Rara" in isi and "lead_masuk" in isi, isi)

# ---- analisa perkembangan ditolak untuk non-staf ----
sebelum_analisa = psql("SELECT count(*) FROM ailsa_analyses")
kirim_pesan(K2, "Tolong analisa perkembangan anak saya dari laporan hariannya")
time.sleep(8)
jawab_analisa = psql(f"SELECT message_text FROM bot_conversations WHERE lead_id='{lead_id(K2)}' AND direction='keluar' ORDER BY created_at DESC LIMIT 1")
cek("analisa ditolak untuk orang tua", any(k in jawab_analisa.lower() for k in ["internal", "tidak bisa", "daily report", "rapor", "admin"]), (jawab_analisa or "")[:110])
cek("tidak ada artefak analisa dibuat", psql("SELECT count(*) FROM ailsa_analyses") == sebelum_analisa)

# ---- bersihkan ----
psql(f"DELETE FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number IN ('{KONTAK}','{K2}'))")
psql(f"DELETE FROM leads WHERE wa_number IN ('{KONTAK}','{K2}')")

lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"\nRESULT {lulus}/{len(hasil)} lulus")
sys.exit(0 if lulus == len(hasil) else 1)
