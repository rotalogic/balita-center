import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Data panel dashboard selain KPI utama: semua dibaca dari database.
export async function GET() {
  try {
    const [recentChildren, recentReports, todayEvents, weekReports, pendingLeaves] = await Promise.all([
      query(
        `SELECT id, full_name, created_at FROM children WHERE deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 5`
      ),
      query(
        `SELECT r.id, r.report_date, r.status, r.created_at, c.full_name AS child_name
           FROM daily_reports r JOIN children c ON c.id = r.child_id
          ORDER BY r.created_at DESC LIMIT 5`
      ),
      query(
        `SELECT id, title, category, location, start_time, end_time FROM school_events
          WHERE event_date = CURRENT_DATE ORDER BY start_time NULLS LAST LIMIT 5`
      ),
      query<{ day: string; n: string }>(
        `SELECT to_char(d::date, 'Dy DD') AS day, COUNT(r.id) AS n
           FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
           LEFT JOIN daily_reports r ON r.report_date = d::date
          GROUP BY d ORDER BY d`
      ),
      query<{ n: string }>("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'menunggu'"),
    ]);
    return NextResponse.json({
      ok: true,
      recentChildren,
      recentReports,
      todayEvents,
      weekReports: weekReports.map((r) => ({ day: r.day, n: Number(r.n) })),
      pendingLeaves: Number(pendingLeaves[0].n),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
