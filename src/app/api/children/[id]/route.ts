import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const child = await query("SELECT * FROM children WHERE id = $1 AND deleted_at IS NULL", [params.id]);
    if (child.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }
    const [guardians, enrollment, reports, health] = await Promise.all([
      query(
        `SELECT g.* FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
          WHERE cg.child_id = $1 ORDER BY cg.is_primary DESC`,
        [params.id]
      ),
      query(
        `SELECT e.*, c.name AS class_name, p.name AS program_name FROM enrollments e
           JOIN classes c ON c.id = e.class_id JOIN programs p ON p.id = e.program_id
          WHERE e.child_id = $1 ORDER BY e.start_date DESC LIMIT 1`,
        [params.id]
      ),
      query("SELECT id, report_date, status, mood FROM daily_reports WHERE child_id = $1 ORDER BY report_date DESC LIMIT 5", [params.id]),
      query("SELECT * FROM health_checks WHERE child_id = $1 ORDER BY checked_on DESC LIMIT 5", [params.id]),
    ]);
    return NextResponse.json({ ok: true, child: child[0], guardians, enrollment: enrollment[0] || null, reports, health });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
