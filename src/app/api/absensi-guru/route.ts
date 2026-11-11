import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Absensi guru & staf: Hadir, Terlambat, Izin, Sakit, Cuti + jam hadir.
// Pendamping absensi anak (/api/attendance); rekap bulanan dibaca SDM.
const STATUS = ["hadir", "terlambat", "izin", "sakit", "cuti"];

type BarisSimpan = { staff_id?: string; status?: string; jam_masuk?: string; catatan?: string };

export async function GET(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const scope = branchScope(denied.user);

    // Rekap bulanan: ?rekap=YYYY-MM
    const rekap = searchParams.get("rekap");
    if (rekap && /^\d{4}-\d{2}$/.test(rekap)) {
      const rows = await query<Record<string, unknown>>(
        `SELECT s.id, s.full_name, s.position, b.name AS branch_name,
                COUNT(a.id) FILTER (WHERE a.status = 'hadir')::int AS hadir,
                COUNT(a.id) FILTER (WHERE a.status = 'terlambat')::int AS terlambat,
                COUNT(a.id) FILTER (WHERE a.status = 'izin')::int AS izin,
                COUNT(a.id) FILTER (WHERE a.status = 'sakit')::int AS sakit,
                COUNT(a.id) FILTER (WHERE a.status = 'cuti')::int AS cuti
           FROM staff s
           LEFT JOIN branches b ON b.id = s.branch_id
           LEFT JOIN staff_attendance a
             ON a.staff_id = s.id
            AND a.work_date >= ($2 || '-01')::date
            AND a.work_date < (($2 || '-01')::date + INTERVAL '1 month')
          WHERE s.deleted_at IS NULL
            AND ($1::uuid[] IS NULL OR s.branch_id = ANY($1::uuid[]))
          GROUP BY s.id, s.full_name, s.position, b.name
          ORDER BY b.name NULLS LAST, s.full_name`,
        [scope, rekap]
      );
      return NextResponse.json({ ok: true, rekap: rows, bulan: rekap });
    }

    const tanggal = searchParams.get("tanggal") || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Format tanggal tidak valid." }, { status: 400 });
    }
    const roster = await query<Record<string, unknown>>(
      `SELECT s.id, s.full_name, s.position, s.branch_id, b.name AS branch_name,
              a.status, to_char(a.check_in AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_masuk, a.catatan
         FROM staff s
         LEFT JOIN branches b ON b.id = s.branch_id
         LEFT JOIN staff_attendance a ON a.staff_id = s.id AND a.work_date = $2::date
        WHERE s.deleted_at IS NULL
          AND ($1::uuid[] IS NULL OR s.branch_id = ANY($1::uuid[]))
        ORDER BY b.name NULLS LAST, s.full_name`,
      [scope, tanggal]
    );
    return NextResponse.json({ ok: true, roster, tanggal });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Simpan absensi seluruh staf untuk satu tanggal (upsert per staf+tanggal).
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { tanggal?: string; entries?: BarisSimpan[] };
    const tanggal = (body.tanggal || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal wajib diisi dengan format yang benar." }, { status: 400 });
    }
    const entries = Array.isArray(body.entries) ? body.entries : [];
    let tersimpan = 0;
    for (const e of entries) {
      if (!e.staff_id || !e.status || !STATUS.includes(e.status)) continue;
      const jam = e.status === "hadir" || e.status === "terlambat" ? (e.jam_masuk || "").slice(0, 5) || null : null;
      const checkIn = jam ? `${tanggal} ${jam}:00+07` : null;
      const hasil = await query<{ id: string }>(
        `INSERT INTO staff_attendance (staff_id, branch_id, work_date, status, check_in, catatan, dicatat_oleh)
         SELECT s.id,
                COALESCE(s.branch_id, (SELECT id FROM branches ORDER BY created_at LIMIT 1)),
                $2::date, $3, $4::timestamptz, $5, $6
           FROM staff s WHERE s.id = $1 AND s.deleted_at IS NULL
         ON CONFLICT (staff_id, work_date) DO UPDATE
           SET status = EXCLUDED.status, check_in = EXCLUDED.check_in,
               catatan = EXCLUDED.catatan, branch_id = EXCLUDED.branch_id,
               dicatat_oleh = EXCLUDED.dicatat_oleh, updated_at = now()
         RETURNING id`,
        [e.staff_id, tanggal, e.status, checkIn, (e.catatan || "").trim() || null, denied.user.id]
      );
      if (hasil.length > 0) tersimpan++;
    }
    await catatAudit(denied.user, {
      action: "absensi_guru.simpan",
      entityTable: "staff_attendance",
      detail: { tanggal, tersimpan },
    });
    return NextResponse.json({ ok: true, tersimpan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
