import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { SQL_ANAK_KELAS } from "@/lib/roster";

export const dynamic = "force-dynamic";

const STATUS = ["hadir", "izin", "sakit", "alpa"];

// Daftar anak satu kelas + status absensi pada tanggal tertentu.
export async function GET(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("class_id") || "";
    const tanggal = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const scope = branchScope(denied.user);

    const kelas = await query<{ id: string; name: string; branch_id: string }>(
      `SELECT id, name, branch_id FROM classes
        WHERE ($1::uuid[] IS NULL OR branch_id = ANY($1::uuid[]))
        ORDER BY name`,
      [scope]
    );
    if (!classId) {
      return NextResponse.json({ ok: true, classes: kelas, children: [], date: tanggal });
    }

    // Roster dari sumber bersama (enrollments ∪ daily_reports).
    const anak = await query<{ id: string; full_name: string; status: string | null }>(
      `SELECT r.id, r.full_name,
              (SELECT a.status FROM child_attendance a
                WHERE a.child_id = r.id AND a.att_date = $2::date LIMIT 1) AS status
         FROM (${SQL_ANAK_KELAS}) r
        ORDER BY r.full_name`,
      [classId, tanggal]
    );
    return NextResponse.json({ ok: true, classes: kelas, children: anak, date: tanggal });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Simpan absensi satu kelas sekaligus (ganti untuk tanggal itu, tidak menggandakan).
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      class_id?: string;
      date?: string;
      entries?: Array<{ child_id: string; status: string }>;
    };

    if (!body.class_id || !body.date) {
      return NextResponse.json({ ok: false, error: "Kelas dan tanggal wajib diisi." }, { status: 400 });
    }
    const entries = (body.entries || []).filter((e) => e.child_id && STATUS.includes(e.status));
    if (entries.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada data absensi untuk disimpan." }, { status: 400 });
    }

    const kelas = await query<{ branch_id: string }>("SELECT branch_id FROM classes WHERE id = $1", [body.class_id]);
    if (kelas.length === 0) {
      return NextResponse.json({ ok: false, error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    await query("DELETE FROM child_attendance WHERE class_id = $1 AND att_date = $2::date", [
      body.class_id,
      body.date,
    ]);

    for (const entry of entries) {
      await query(
        `INSERT INTO child_attendance (branch_id, child_id, class_id, att_date, status)
         VALUES ($1,$2,$3,$4::date,$5)
         ON CONFLICT (child_id, att_date) DO UPDATE SET status = EXCLUDED.status, class_id = EXCLUDED.class_id`,
        [kelas[0].branch_id, entry.child_id, body.class_id, body.date, entry.status]
      );
    }

    const hadir = entries.filter((e) => e.status === "hadir").length;
    return NextResponse.json({ ok: true, tersimpan: entries.length, hadir });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
