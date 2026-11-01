import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Detail satu laporan harian beserta aktivitas dan medianya, untuk pratinjau review.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const report = await query(
      `SELECT r.*, c.full_name AS child_name, cl.name AS class_name,
              s.full_name AS teacher_name, lf.full_name AS facilitator_name
         FROM daily_reports r
         JOIN children c ON c.id = r.child_id
         JOIN classes cl ON cl.id = r.class_id
         JOIN staff s ON s.id = r.created_by
         LEFT JOIN staff lf ON lf.id = r.lead_facilitator_id
        WHERE r.id = $1`,
      [params.id]
    );
    if (report.length === 0) {
      return NextResponse.json({ ok: false, error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    const [activities, photos] = await Promise.all([
      query("SELECT * FROM daily_report_activities WHERE report_id = $1 ORDER BY sort_order", [params.id]),
      query("SELECT * FROM daily_report_photos WHERE report_id = $1 ORDER BY created_at", [params.id]),
    ]);
    return NextResponse.json({ ok: true, report: report[0], activities, photos });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
