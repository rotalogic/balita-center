#!/usr/bin/env python3
"""Blok H: bot Ailsa — webhook, tanda tangan, bank pengetahuan, panen lead."""
import hashlib
import hmac
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3011"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
VERIFY = "verify-token-uji"
SECRET = "app-secret-uji"
SUF = secrets.token_hex(3).upper()
WA = "6282" + str(secrets.randbelow(10**8)).zfill(8)
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
        teks = e.read().decode()
        try:
            return e.code, json.loads(teks)
        except Exception:
            return e.code, {}


def kirim_wa(teks, signature="valid", wa=WA):
    body = json.dumps({
        "entry": [{"changes": [{"value": {"messages": [{"from": wa, "type": "text", "text": {"body": teks}}]}}]}]
    }).encode()
    headers = {"Content-Type": "application/json"}
    if signature == "valid":
        headers["X-Hub-Signature-256"] = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    elif signature == "salah":
        headers["X-Hub-Signature-256"] = "sha256=" + "0" * 64
    request = urllib.request.Request(BASE + "/api/whatsapp/webhook", body, headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=40) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        teks = e.read().decode()
        try:
            return e.code, json.loads(teks)
        except Exception:
            return e.code, {}


psql("DELETE FROM bot_knowledge_entries WHERE question_sample = 'apakah anak wajib pakai seragam'")

admin = session()
call(admin, "/api/auth/login", {"email": "admin@balitacenter.id", "password": PASSWORD})

# ---------- 1. verifikasi webhook ----------
code, _ = call(admin, f"/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token={VERIFY}&hub.challenge=12345")
check("verifikasi token benar", code == 200, f"HTTP {code}")
code, _ = call(admin, f"/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=12345")
check("token salah ditolak", code == 403, f"HTTP {code}")

# ---------- 2. tanda tangan ----------
code, body = kirim_wa("Halo", signature="salah")
check("tanda tangan salah ditolak", code == 401, f"HTTP {code}")
code, body = kirim_wa("Halo", signature="none")
check("tanpa tanda tangan ditolak", code == 401, f"HTTP {code}")

# ---------- 3. pesan masuk diproses ----------
code, body = kirim_wa("menu")
check("pesan bertanda tangan diterima", code == 200 and body.get("diterima") == 1, f"HTTP {code}")
import time
time.sleep(2)
masuk = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}')")
check("percakapan tercatat di DB", int(masuk) >= 2, f"{masuk} baris")
check("lead dibuat dari WhatsApp",
      psql(f"SELECT source FROM leads WHERE wa_number='{WA}'") == "whatsapp_ailsa")

# ---------- 4. bank pengetahuan ----------
# entri draft TIDAK boleh dipakai
code, body = call(admin, "/api/ailsa", {"question_sample": "apakah anak wajib pakai seragam", "answer_text": "Seragam disediakan sekolah, sudah termasuk SPP."})
entri_id = body.get("id")
check("entri bank pengetahuan dibuat", code == 200 and bool(entri_id), f"HTTP {code}")
check("entri baru berstatus draft", psql(f"SELECT status FROM bot_knowledge_entries WHERE id='{entri_id}'") == "draft")

kirim_wa("apakah anak wajib pakai seragam")
time.sleep(1.5)
jawab = psql(f"SELECT message_text FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}') AND direction='keluar' ORDER BY created_at DESC LIMIT 1")
check("entri draft tidak dipakai", "seragam disediakan" not in jawab.lower(), jawab[:60])

# setujui lalu tanya lagi
call(admin, f"/api/ailsa/{entri_id}", {"status": "aktif"}, method="PATCH")
check("entri disetujui", psql(f"SELECT status FROM bot_knowledge_entries WHERE id='{entri_id}'") == "aktif")

kirim_wa("apakah anak wajib pakai seragam")
time.sleep(1.5)
jawab2 = psql(f"SELECT message_text FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}') AND direction='keluar' ORDER BY created_at DESC LIMIT 1")
check("entri aktif dipakai Ailsa", "seragam disediakan" in jawab2.lower(), jawab2[:70])

# biaya dijawab dari data Program (bukan teks statis)
kirim_wa("berapa biaya spp")
time.sleep(1.5)
jawab3 = psql(f"SELECT message_text FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}') AND direction='keluar' ORDER BY created_at DESC LIMIT 1")
check("biaya dibaca dari data Program", "Rp" in jawab3 and "Reguler" in jawab3, jawab3[:80])

# ---------- 5. panen lead bertahap ----------
kirim_wa("halo")
time.sleep(1.2)
for pesan in ["2", "Ibu Sari", "Raka", "3 tahun", "1", "1"]:
    kirim_wa(pesan)
    time.sleep(1.2)

lead = psql(f"SELECT coalesce(parent_name,'')||'|'||coalesce(child_name,'')||'|'||coalesce(child_age_months::text,'')||'|'||coalesce(stage,'') FROM leads WHERE wa_number='{WA}'")
bagian = lead.split("|")
check("nama orang tua tersimpan", bagian[0] == "Ibu Sari", bagian[0])
check("nama anak tersimpan", bagian[1] == "Raka", bagian[1])
check("usia jadi bulan", bagian[2] == "36", bagian[2])
check("lead tetap di pipeline", bagian[3] in ("lead_masuk", "dihubungi"), bagian[3])

# ---------- 6. STOP ----------
kirim_wa("STOP")
time.sleep(1.5)
check("opt-out tercatat", psql(f"SELECT bot_status FROM leads WHERE wa_number='{WA}'") == "tidak_lanjut",
      psql(f"SELECT bot_status FROM leads WHERE wa_number='{WA}'"))

sebelum = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}')")
kirim_wa("halo lagi")
time.sleep(1.5)
sesudah = psql(f"SELECT count(*) FROM bot_conversations WHERE lead_id IN (SELECT id FROM leads WHERE wa_number='{WA}')")
check("pesan masuk tetap dicatat walau opt-out", int(sesudah) > int(sebelum), f"{sebelum} → {sesudah}")

# ---------- 7. tidak ada kredensial di respons API ----------
code, raw = 0, ""
try:
    with admin.open(BASE + "/api/ailsa", timeout=30) as r:
        raw = r.read().decode()
except urllib.error.HTTPError as e:
    raw = e.read().decode()
check("respons API tanpa token", "app-secret-uji" not in raw and "verify-token-uji" not in raw)

# ---------- bersihkan ----------
lead_id = psql(f"SELECT id FROM leads WHERE wa_number='{WA}'")
if lead_id:
    psql(f"DELETE FROM bot_conversations WHERE lead_id='{lead_id}'")
    psql(f"DELETE FROM leads WHERE id='{lead_id}'")
psql(f"DELETE FROM bot_knowledge_entries WHERE id='{entri_id}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM leads WHERE wa_number='{WA}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
