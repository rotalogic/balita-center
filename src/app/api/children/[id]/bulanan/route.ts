import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { kataSkor } from "@/lib/skala";

export const dynamic = "force-dynamic";

// Ringkasan bulanan satu anak, dihitung langsung dari data yang sudah ada:
// absensi (child_attendance), laporan harian + aktivitasnya, observasi
// milestone, penilaian STPPA, dan penilaian perkembangan berkala.
// Lapisan tengah Satu Meja Laporan: harian mengalir ke bulanan, bulanan
// menjadi bahan rapor semester. Tidak ada tabel baru dan tidak ada angka
// yang diketik ulang guru.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const sekarang = new Date();
    const bulanParam = url.searchParams.get("bulan") || "";
    const bulan = /^\d{4}-\d{2}$/.test(bulanParam)
      ? bulanParam
      : `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
    const awal = `${bulan}-01`;
    const akhirBulan = new Date(`${awal}T00:00:00`);
    akhirBulan.setMonth(akhirBulan.getMonth() + 1);
    const akhir = akhirBulan.toISOString().slice(0, 10);

    const anak = await query<{ id: string }>(
      "SELECT id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }

    const [kehadiran, laporan, aktivitas, area, milestone, stppa, perkembangan] = await Promise.all([
      query<{ status: string; n: string }>(
        `SELECT status, COUNT(*)::text AS n FROM child_attendance
          WHERE child_id = $1 AND att_date >= $2::date AND att_date < $3::date
          GROUP BY status`,
        [params.id, awal, akhir]
      ),
      query<{ status: string; n: string }>(
        `SELECT status, COUNT(*)::text AS n FROM daily_reports
          WHERE child_id = $1 AND deleted_at IS NULL
            AND report_date >= $2::date AND report_date < $3::date
          GROUP BY status`,
        [params.id, awal, akhir]
      ),
      query<{ rating: number; n: string }>(
        `SELECT a.rating, COUNT(*)::text AS n FROM daily_report_activities a
           JOIN daily_reports r ON r.id = a.report_id
          WHERE r.child_id = $1 AND r.deleted_at IS NULL
            AND r.report_date >= $2::date AND r.report_date < $3::date
            AND a.rating IS NOT NULL
          GROUP BY a.rating ORDER BY a.rating`,
        [params.id, awal, akhir]
      ),
      query<{ area: string; n: string }>(
        `SELECT COALESCE(a.area, 'Lainnya') AS area, COUNT(*)::text AS n
           FROM daily_report_activities a
           JOIN daily_reports r ON r.id = a.report_id
          WHERE r.child_id = $1 AND r.deleted_at IS NULL
            AND r.report_date >= $2::date AND r.report_date < $3::date
          GROUP BY COALESCE(a.area, 'Lainnya') ORDER BY COUNT(*) DESC`,
        [params.id, awal, akhir]
      ),
      query<{ level: number; n: string }>(
        `SELECT level, COUNT(*)::text AS n
           FROM milestone_observations
          WHERE child_id = $1 AND observed_on >= $2::date AND observed_on < $3::date
            AND level IS NOT NULL
          GROUP BY level ORDER BY level`,
        [params.id, awal, akhir]
      ),
      query<{ tercapai: string; dinilai: string }>(
        `SELECT COUNT(*) FILTER (WHERE achieved)::text AS tercapai, COUNT(*)::text AS dinilai
           FROM stppa_assessments
          WHERE child_id = $1 AND assessed_at >= $2::date AND assessed_at < $3::date`,
        [params.id, awal, akhir]
      ),
      query<Record<string, unknown>>(
        `SELECT recorded_on, physical_pct, gross_motor_pct, fine_motor_pct, cognitive_pct,
                language_pct, social_emotional_pct, independence_pct, teacher_notes,
                parent_recommendations
           FROM child_development_records
          WHERE child_id = $1 AND recorded_on >= $2::date AND recorded_on < $3::date
          ORDER BY recorded_on DESC LIMIT 1`,
        [params.id, awal, akhir]
      ),
    ]);

    const hitung = (rows: Array<{ status: string; n: string }>, status: string) =>
      Number(rows.find((r) => r.status === status)?.n || 0);

    return NextResponse.json({
      ok: true,
      bulan,
      kehadiran: {
        hadir: hitung(kehadiran, "hadir"),
        izin: hitung(kehadiran, "izin"),
        sakit: hitung(kehadiran, "sakit"),
        alpa: hitung(kehadiran, "alpa"),
      },
      laporan: {
        terbit: hitung(laporan, "published"),
        draf: hitung(laporan, "draft"),
        proses: hitung(laporan, "menunggu_review") + hitung(laporan, "disetujui"),
      },
      aktivitas: {
        total: aktivitas.reduce((s, r) => s + Number(r.n), 0),
        per_rating: aktivitas.map((r) => ({ rating: Number(r.rating), jumlah: Number(r.n) })),
        per_area: area.map((r) => ({ area: r.area, jumlah: Number(r.n) })),
      },
      milestone: milestone.map((r) => ({ level: kataSkor(r.level) || `Level ${r.level}`, jumlah: Number(r.n) })),
      stppa: {
        dinilai: Number(stppa[0]?.dinilai || 0),
        tercapai: Number(stppa[0]?.tercapai || 0),
      },
      perkembangan_terakhir: perkembangan[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
