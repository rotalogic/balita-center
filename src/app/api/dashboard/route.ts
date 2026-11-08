import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Data panel dashboard selain KPI utama: semua dibaca dari database.
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const cabang = new URL(request.url).searchParams.get("branch_id") || null;
    const [recentChildren, recentReports, todayEvents, weekReports, pendingLeaves] = await Promise.all([
      query(
        `SELECT id, full_name, created_at FROM children WHERE deleted_at IS NULL
           AND ($1::uuid IS NULL OR branch_id = $1::uuid)
          ORDER BY created_at DESC LIMIT 5`,
        [cabang]
      ),
      query(
        `SELECT r.id, r.report_date, r.status, r.created_at, c.full_name AS child_name
           FROM daily_reports r JOIN children c ON c.id = r.child_id
        WHERE r.deleted_at IS NULL AND ($1::uuid IS NULL OR r.branch_id = $1::uuid)
          ORDER BY r.created_at DESC LIMIT 5`,
        [cabang]
      ),
      query(
        `SELECT id, title, category, location, start_time, end_time FROM school_events
          WHERE event_date = CURRENT_DATE AND ($1::uuid IS NULL OR branch_id = $1::uuid)
          ORDER BY start_time NULLS LAST LIMIT 5`,
        [cabang]
      ),
      query<{ day: string; n: string }>(
        `SELECT to_char(d::date, 'Dy DD') AS day, COUNT(r.id) AS n
           FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
           LEFT JOIN daily_reports r ON r.report_date = d::date AND r.deleted_at IS NULL
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
