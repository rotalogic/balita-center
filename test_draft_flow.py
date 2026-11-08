#!/usr/bin/env python3
"""Blok A: alur draft Daily Report (buat -> buka -> edit -> kirim -> review -> terbit -> hapus)."""
import http.cookiejar
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3011"
ADMIN = "admin@balitacenter.id"
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


op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(path, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(BASE + path, data, {"Content-Type": "application/json"}, method=method)
    try:
        with op.open(request, timeout=40) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


code, _ = call("/api/auth/login", {"email": ADMIN, "password": PASSWORD})
check("login admin", code == 200, f"HTTP {code}")

# ---------- data uji (semua berawalan TEST -) ----------
code, body = call("/api/meta", {"kind": "branch", "code": f"TEST{SUF}", "name": f"TEST - Cabang {SUF}"})
branch = body.get("item", {}).get("id")
code, body = call("/api/meta", {"kind": "program", "code": f"TEST{SUF}", "name": f"TEST - Program {SUF}", "monthly_fee": 500000})
program = body.get("item", {}).get("id")
code, body = call("/api/meta", {"kind": "class", "branch_id": branch, "program_id": program, "name": f"TEST - Kelas {SUF}"})
klass = body.get("item", {}).get("id")
code, body = call("/api/meta", {"kind": "staff", "branch_id": branch, "full_name": f"TEST - Guru {SUF}", "position": "Guru Kelas"})
staff = body.get("item", {}).get("id")
check("data uji siap", all([branch, program, klass, staff]))

code, body = call("/api/children", {
    "branch_id": branch, "program_id": program, "class_id": klass,
    "full_name": f"TEST - Anak {SUF}", "birth_date": "2022-05-01", "gender": "laki-laki",
})
child = body.get("id")
check("anak uji dibuat", code == 200 and bool(child), f"HTTP {code}")

# ---------- 1. buat draft ----------
code, body = call("/api/daily-reports", {
    "branch_id": branch, "child_id": child, "class_id": klass, "created_by": staff,
    "report_date": "2026-11-03", "meal_level": "banyak", "snack_level": "cukup",
    "nap_quality": "baik", "mood": "ceria", "notes": "catatan awal",
    "submit": False,
    "activities": [{"title": "TEST - Circle Time", "area": "Kognitif"}],
})
rid = body.get("id")
check("buat draft", code == 200 and bool(rid), f"HTTP {code}")

st = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
check("status tersimpan = draft", st == "draft", st)

# ---------- 2. draft muncul di daftar ----------
code, body = call("/api/daily-reports?status=draft")
found = [r for r in body.get("reports", []) if r["id"] == rid]
check("draft muncul di daftar", len(found) == 1, f"{len(found)} baris")
check("daftar membawa status", found and found[0]["status"] == "draft")

# ---------- 3. buka draft (isi lengkap) ----------
code, body = call(f"/api/daily-reports/{rid}")
check("buka draft", code == 200 and body.get("ok"), f"HTTP {code}")
rep = body.get("report", {})
check("isi draft termuat", rep.get("notes") == "catatan awal" and rep.get("meal_level") == "banyak",
      f"notes={rep.get('notes')}")
check("aktivitas termuat", len(body.get("activities", [])) == 1, f"{len(body.get('activities', []))} aktivitas")

# ---------- 4. edit draft ----------
code, body = call(f"/api/daily-reports/{rid}", {
    "notes": "catatan setelah diedit", "mood": "sangat_ceria",
    "activities": [
        {"title": "TEST - Circle Time", "area": "Kognitif", "apparatus": "Kartu warna", "rating": 5,
         "photo_url": "/api/files/test.png"},
        {"title": "TEST - Practical Life", "apparatus": "Baki tuang", "rating": 4},
    ],
}, method="PATCH")
check("simpan perubahan draft", code == 200 and body.get("ok"), f"HTTP {code}")

notes = psql(f"SELECT notes FROM daily_reports WHERE id='{rid}'")
acts = psql(f"SELECT count(*) FROM daily_report_activities WHERE report_id='{rid}'")
check("perubahan tersimpan", notes == "catatan setelah diedit", notes)
check("aktivitas terganti (bukan dobel)", acts == "2", acts)

# ---------- 5. kirim review tanpa fasilitator -> ditolak spesifik ----------
code, body = call(f"/api/daily-reports/{rid}", {"submit": True}, method="PATCH")
check("kirim ditolak bila syarat kurang", code == 422, f"HTTP {code}")
check("alasan kurang disebut spesifik", any("Fasilitator" in k for k in body.get("kurang", [])),
      str(body.get("kurang")))

st = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
check("status tetap draft setelah ditolak", st == "draft", st)

# ---------- 6. lengkapi lalu kirim ----------
code, body = call(f"/api/daily-reports/{rid}", {"lead_facilitator_id": staff}, method="PATCH")
check("pilih fasilitator", code == 200 and body.get("ok"), f"HTTP {code}")
code, body = call(f"/api/daily-reports/{rid}", {"submit": True}, method="PATCH")
check("kirim untuk review berhasil", code == 200 and body.get("status") == "menunggu_review", f"HTTP {code}")

st = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
check("status = menunggu_review", st == "menunggu_review", st)

# ---------- 7. edit ditolak setelah dikirim ----------
code, body = call(f"/api/daily-reports/{rid}", {"notes": "coba edit"}, method="PATCH")
check("edit ditolak setelah dikirim", code == 409, f"HTTP {code}")

# ---------- 8. review -> terbit ----------
code, body = call(f"/api/daily-reports/{rid}/review", {"action": "setujui", "reviewer_id": staff})
check("setujui laporan", code == 200, f"HTTP {code}")
code, body = call(f"/api/daily-reports/{rid}/review", {"action": "terbitkan", "reviewer_id": staff})
check("terbitkan laporan", code == 200, f"HTTP {code}")
st = psql(f"SELECT status FROM daily_reports WHERE id='{rid}'")
check("status = published", st == "published", st)

# ---------- 9. laporan terbit tidak bisa dihapus ----------
code, body = call(f"/api/daily-reports/{rid}", method="DELETE")
check("hapus laporan terbit ditolak", code == 409, f"HTTP {code}")

# ---------- 10. draft baru bisa dihapus ----------
code, body = call("/api/daily-reports", {
    "branch_id": branch, "child_id": child, "class_id": klass, "created_by": staff,
    "report_date": "2026-11-04", "submit": False,
})
rid2 = body.get("id")
code, body = call(f"/api/daily-reports/{rid2}", method="DELETE")
check("hapus draft berhasil", code == 200 and body.get("ok"), f"HTTP {code}")
left = psql(f"SELECT count(*) FROM daily_reports WHERE id='{rid2}' AND deleted_at IS NULL")
check("draft benar-benar hilang", left == "0", left)

# ---------- bersihkan ----------
psql(f"DELETE FROM daily_report_reviews WHERE report_id='{rid}'")
psql(f"DELETE FROM daily_report_activities WHERE report_id='{rid}'")
psql(f"DELETE FROM daily_report_photos WHERE report_id='{rid}'")
psql(f"DELETE FROM daily_reports WHERE id='{rid}'")
psql(f"DELETE FROM enrollments WHERE child_id='{child}'")
psql(f"DELETE FROM child_guardians WHERE child_id='{child}'")
psql(f"DELETE FROM children WHERE id='{child}'")
psql(f"DELETE FROM daily_report_reviews WHERE report_id IN (SELECT id FROM daily_reports WHERE branch_id='{branch}')")
psql(f"DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE branch_id='{branch}')")
psql(f"DELETE FROM daily_report_photos WHERE report_id IN (SELECT id FROM daily_reports WHERE branch_id='{branch}')")
psql(f"DELETE FROM daily_reports WHERE branch_id='{branch}'")
psql(f"DELETE FROM leave_requests WHERE branch_id='{branch}'")
psql(f"DELETE FROM staff WHERE id='{staff}'")
psql(f"DELETE FROM staff WHERE branch_id='{branch}'")
psql(f"DELETE FROM classes WHERE id='{klass}'")
psql(f"DELETE FROM programs WHERE id='{program}'")
KIDS = f"SELECT id FROM children WHERE branch_id='{branch}'"
psql(f"DELETE FROM child_attendance WHERE child_id IN ({KIDS})")
psql(f"DELETE FROM invoices WHERE child_id IN ({KIDS})")
psql(f"DELETE FROM enrollments WHERE child_id IN ({KIDS}) OR branch_id='{branch}'")
psql(f"DELETE FROM child_guardians WHERE child_id IN ({KIDS})")
psql(f"DELETE FROM children WHERE branch_id='{branch}'")
psql(f"DELETE FROM classes WHERE branch_id='{branch}'")
psql(f"DELETE FROM branches WHERE id='{branch}'")
sisa = psql(f"SELECT count(*) FROM branches WHERE id='{branch}'")
check("data uji dibersihkan", sisa == "0", sisa)

print("\nRESULT:", "SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
