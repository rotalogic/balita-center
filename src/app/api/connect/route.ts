import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Data Balita Connect untuk satu anak. Tanpa child_id, dipakai anak pertama
// menurut abjad agar portal bisa langsung dicoba; aplikasi produksi wajib
// mengganti ini dengan anak milik akun orang tua yang login.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let childId = searchParams.get("child_id");
    if (!childId) {
      const first = await query<{ id: string }>(
        "SELECT id FROM children WHERE deleted_at IS NULL ORDER BY full_name LIMIT 1"
      );
      if (first.length === 0) {
        return NextResponse.json({ ok: true, child: null });
      }
      childId = first[0].id;
    }
    const [child, report, activities, health, development, events, messages, photos, invoices] = await Promise.all([
      query("SELECT * FROM children WHERE id = $1", [childId]),
      query(
        `SELECT * FROM daily_reports WHERE child_id = $1 AND status = 'published'
          ORDER BY report_date DESC LIMIT 1`,
        [childId]
      ),
      query(
        `SELECT a.* FROM daily_report_activities a
           JOIN daily_reports r ON r.id = a.report_id
          WHERE r.child_id = $1 AND r.status = 'published'
          ORDER BY r.report_date DESC, a.sort_order LIMIT 20`,
        [childId]
      ),
      query("SELECT * FROM health_checks WHERE child_id = $1 ORDER BY checked_on DESC LIMIT 12", [childId]),
      query("SELECT * FROM child_development_records WHERE child_id = $1 ORDER BY recorded_on DESC LIMIT 6", [childId]),
      query(
        `SELECT e.*, r.response AS my_rsvp FROM school_events e
           LEFT JOIN event_rsvps r ON r.event_id = e.id AND r.child_id = $1
          WHERE e.event_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY e.event_date LIMIT 20`,
        [childId]
      ),
      query(
        `SELECT m.*, u.full_name AS sender_name FROM parent_messages m
           JOIN users u ON u.id = m.sender_user_id
          WHERE m.child_id = $1 ORDER BY m.sent_at DESC LIMIT 30`,
        [childId]
      ),
      query(
        `SELECT p.id, p.photo_url AS url, p.caption, r.report_date FROM daily_report_photos p
           JOIN daily_reports r ON r.id = p.report_id
          WHERE r.child_id = $1 AND r.status = 'published'
          ORDER BY r.report_date DESC LIMIT 60`,
        [childId]
      ),
      query(
        `SELECT i.*, (SELECT COALESCE(SUM(pay.amount),0) FROM payments pay WHERE pay.invoice_id = i.id AND pay.status = 'terkonfirmasi') AS paid_total
           FROM invoices i WHERE i.child_id = $1 ORDER BY i.due_date DESC LIMIT 24`,
        [childId]
      ),
    ]);
    return NextResponse.json({
      ok: true,
      child: child[0] || null,
      report: report[0] || null,
      activities,
      health,
      development,
      events,
      messages,
      photos,
      invoices,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind: string;
      child_id: string;
      event_id?: string;
      guardian_id?: string;
      response?: string;
    };
    if (body.kind === "rsvp") {
      if (!body.child_id || !body.event_id || !body.response) {
        return NextResponse.json({ ok: false, error: "Data RSVP tidak lengkap." }, { status: 400 });
      }
      const eventRows = await query<{ branch_id: string }>("SELECT branch_id FROM school_events WHERE id = $1", [body.event_id]);
      if (eventRows.length === 0) return NextResponse.json({ ok: false, error: "Kegiatan tidak ditemukan." }, { status: 404 });
      await query(
        `INSERT INTO event_rsvps (branch_id, event_id, child_id, guardian_id, response)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (event_id, child_id) DO UPDATE SET response = EXCLUDED.response, responded_at = CURRENT_TIMESTAMP`,
        [eventRows[0].branch_id, body.event_id, body.child_id, body.guardian_id || null, body.response]
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
