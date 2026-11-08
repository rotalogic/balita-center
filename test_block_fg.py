#!/usr/bin/env python3
"""Blok F & G: siklus belajar, STPPA, pengajuan cuti + persetujuan, absensi kelas."""
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
        teks = e.read().decode()
        try:
            return e.code, json.loads(teks)
        except Exception:
            return e.code, {}


admin = session()
call(admin, "/api/auth/login", {"email": "admin@balitacenter.id", "password": PASSWORD})

# ---------- data awal ----------
_, body = call(admin, "/api/meta", {"kind": "branch", "code": f"TESTG{SUF}", "name": f"TEST - Cabang G {SUF}"})
br = body.get("item", {}).get("id")
_, body = call(admin, "/api/meta", {"kind": "program", "code": f"TESTG{SUF}", "name": f"TEST - Program G {SUF}", "monthly_fee": 700000})
pr = body.get("item", {}).get("id")
_, body = call(admin, "/api/meta", {"kind": "class", "branch_id": br, "program_id": pr, "name": f"TEST - Kelas G {SUF}"})
kl = body.get("item", {}).get("id")
_, body = call(admin, "/api/children", {
    "branch_id": br, "program_id": pr, "class_id": kl,
    "full_name": f"TEST - Anak G {SUF}", "birth_date": "2022-07-07", "gender": "perempuan",
})
anak = body.get("id")
check("data awal siap", all([br, pr, kl, anak]))

# ---------- F1: siklus belajar ----------
code, body = call(admin, "/api/academic", {
    "kind": "cycle", "branch_id": br, "class_id": kl,
    "theme": f"TEST - Tema {SUF}", "start_date": "2026-11-01", "end_date": "2026-11-30",
})
siklus = body.get("id")
check("siklus dibuat", code == 200 and bool(siklus), f"HTTP {code} {body.get('error','')[:50]}")

code, body = call(admin, "/api/academic", {
    "kind": "cycle", "branch_id": br, "class_id": kl,
    "theme": "TEST - Terbalik", "start_date": "2026-12-31", "end_date": "2026-12-01",
})
check("tanggal terbalik ditolak", code == 400, f"HTTP {code}")

code, body = call(admin, "/api/academic", {"kind": "cycle", "branch_id": br, "class_id": kl, "theme": "ab"})
check("tema terlalu pendek ditolak", code == 400, f"HTTP {code}")

# ---------- F1: STPPA ----------
code, body = call(admin, "/api/academic", {
    "kind": "stppa", "age_group": "3-4 tahun", "aspect": "nilai_agama_moral",
    "item_text": f"TEST - Anak terbiasa berdoa sebelum kegiatan {SUF}", "sort_order": 1,
})
butir = body.get("id")
check("butir STPPA dibuat", code == 200 and bool(butir), f"HTTP {code}")

code, body = call(admin, "/api/academic", {"kind": "stppa", "age_group": "9-9 tahun", "aspect": "motorik_kasar", "item_text": "abc"})
check("butir terlalu pendek ditolak", code == 400, f"HTTP {code}")

code, body = call(admin, "/api/academic", method="GET")
kode_terdaftar = [c["id"] for c in body.get("cycles", [])]
butir_terdaftar = [s["id"] for s in body.get("stppa", [])]
check("siklus tampil di daftar", siklus in kode_terdaftar)
check("butir STPPA tampil di daftar", butir in butir_terdaftar)

code, body = call(admin, f"/api/academic/{butir}?kind=stppa", method="DELETE")
check("butir STPPA bisa dihapus", code == 200, f"HTTP {code}")

code, body = call(admin, f"/api/academic/{siklus}?kind=cycle", method="DELETE")
check("siklus kosong bisa dihapus", code == 200, f"HTTP {code}")

# ---------- F2: cuti ----------
psql(f"INSERT INTO staff (branch_id, full_name, position, email, status) VALUES ('{br}', 'TEST - Staf {SUF}', 'Guru', 'admin@balitacenter.id', 'aktif')")
staf_id = psql(f"SELECT id FROM staff WHERE email='admin@balitacenter.id' AND branch_id='{br}'")
check("staf uji dibuat", bool(staf_id))

code, body = call(admin, "/api/hr/leave", {
    "kind": "cuti", "start_date": "2026-12-01", "end_date": "2026-12-03", "reason": f"TEST - keperluan {SUF}",
})
cuti = body.get("id")
check("pengajuan cuti dibuat", code == 200 and bool(cuti), f"HTTP {code} {body.get('error','')[:50]}")
check("status awal menunggu", psql(f"SELECT status FROM leave_requests WHERE id='{cuti}'") == "menunggu")

code, body = call(admin, "/api/hr/leave", {"kind": "sakit", "start_date": "2026-12-01", "end_date": "2026-12-02"})
check("jenis tidak dikenal ditolak", code == 400, f"HTTP {code}")

code, body = call(admin, "/api/hr/leave", {"kind": "izin", "start_date": "2026-12-05", "end_date": "2026-12-01"})
check("tanggal terbalik ditolak", code == 400, f"HTTP {code}")

code, body = call(admin, f"/api/hr/leave/{cuti}", {"status": "disetujui"}, method="PATCH")
check("cuti disetujui", code == 200 and body.get("ok"), f"HTTP {code} {body.get('error','')[:40]}")
check("status jadi disetujui", psql(f"SELECT status FROM leave_requests WHERE id='{cuti}'") == "disetujui")

code, body = call(admin, f"/api/hr/leave/{cuti}", {"status": "ditolak"}, method="PATCH")
check("putusan ganda ditolak", code == 409, f"HTTP {code}")

code, body = call(admin, f"/api/hr/leave/{cuti}", {"status": "ngawur"}, method="PATCH")
check("status asing ditolak", code == 400, f"HTTP {code}")

# ---------- G: absensi ----------
code, body = call(admin, f"/api/attendance?class_id={kl}&date=2026-11-04")
nama = [c["full_name"] for c in body.get("children", [])]
check("daftar anak kelas tampil", any("Anak G" in n for n in nama), f"{len(nama)} anak")

code, body = call(admin, "/api/attendance", {
    "class_id": kl, "date": "2026-11-04",
    "entries": [{"child_id": anak, "status": "hadir"}],
})
check("absensi tersimpan", code == 200 and body.get("tersimpan") == 1, f"HTTP {code} {body.get('error','')[:40]}")

code, body = call(admin, f"/api/attendance?class_id={kl}&date=2026-11-04")
status_anak = body.get("children", [{}])[0].get("status")
check("status terbaca kembali", status_anak == "hadir", str(status_anak))

# timpa dengan status lain (tidak dobel)
call(admin, "/api/attendance", {"class_id": kl, "date": "2026-11-04", "entries": [{"child_id": anak, "status": "sakit"}]})
jumlah = psql(f"SELECT count(*) FROM child_attendance WHERE child_id='{anak}' AND att_date='2026-11-04'")
check("tidak ada baris dobel", jumlah == "1", jumlah)

code, body = call(admin, "/api/attendance", {"class_id": kl, "date": "2026-11-04", "entries": [{"child_id": anak, "status": "bolos"}]})
check("status absensi asing ditolak", code == 400, f"HTTP {code}")

# ---------- bersihkan ----------
psql(f"DELETE FROM child_attendance WHERE child_id='{anak}'")
psql(f"DELETE FROM leave_requests WHERE id='{cuti}'")
psql(f"DELETE FROM staff WHERE branch_id='{br}'")
psql(f"DELETE FROM enrollments WHERE child_id='{anak}'")
psql(f"DELETE FROM child_guardians WHERE child_id='{anak}'")
psql(f"DELETE FROM children WHERE id='{anak}'")
psql(f"DELETE FROM learning_cycles WHERE branch_id='{br}'")
psql("DELETE FROM stppa_items WHERE item_text ILIKE 'TEST%'")
psql(f"DELETE FROM classes WHERE id='{kl}'")
psql(f"DELETE FROM branches WHERE id='{br}'")
psql(f"DELETE FROM programs WHERE id='{pr}'")
check("data uji dibersihkan", psql(f"SELECT count(*) FROM branches WHERE id='{br}'") == "0")

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
