import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [staff, leaves, attendanceToday] = await Promise.all([
      query(
        `SELECT s.*, b.name AS branch_name FROM staff s JOIN branches b ON b.id = s.branch_id
          WHERE s.deleted_at IS NULL ORDER BY s.full_name LIMIT 100`
      ),
      query(
        `SELECT l.*, s.full_name AS staff_name FROM leave_requests l JOIN staff s ON s.id = l.staff_id
          ORDER BY l.submitted_at DESC LIMIT 50`
      ),
      query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM staff_attendance WHERE work_date = CURRENT_DATE"
      ),
    ]);
    return NextResponse.json({ ok: true, staff, leaves, attendanceToday: Number(attendanceToday[0].n) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    if (body.action === "putuskan_cuti") {
      if (!body.leave_id || !body.decided_by || !["disetujui", "ditolak"].includes(body.decision)) {
        return NextResponse.json({ ok: false, error: "Data keputusan cuti tidak lengkap." }, { status: 400 });
      }
      await query(
        "UPDATE leave_requests SET status = $1, decided_by = $2, decided_at = CURRENT_TIMESTAMP WHERE id = $3 AND status = 'menunggu'",
        [body.decision, body.decided_by, body.leave_id]
      );
      return NextResponse.json({ ok: true, status: body.decision });
    }
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
