import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Data Balita Connect untuk satu anak.
// Orang tua/murid HANYA bisa membuka anak yang terhubung ke akunnya lewat
// guardians.email. Staf (super_admin/owner/kepala_sekolah) boleh memilih anak
// mana pun untuk keperluan pratinjau.
export async function GET(request: Request) {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  const user = denied.user;
  try {
    const { searchParams } = new URL(request.url);
    let childId = searchParams.get("child_id");
    const preview = searchParams.get("preview") === "1";

    const globalViewer = [...user.roles, user.role].some((role) =>
      ["super_admin", "owner", "kepala_sekolah"].includes(role)
    );

    if (!globalViewer) {
      const milik = await query<{ id: string }>(
        `SELECT c.id
           FROM children c
           JOIN child_guardians cg ON cg.child_id = c.id
           JOIN guardians g ON g.id = cg.guardian_id
          WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL
          ORDER BY c.full_name`,
        [user.email]
      );
      const allowed = milik.map((row) => row.id);
      if (allowed.length === 0) {
        return NextResponse.json({
          ok: true,
          child: null,
          message: "Akun Anda belum terhubung ke data anak. Hubungi admin sekolah.",
        });
      }
      if (!childId) {
        childId = allowed[0];
      } else if (!allowed.includes(childId)) {
        return NextResponse.json(
          { ok: false, error: "Anda tidak berhak melihat data anak ini." },
          { status: 403 }
        );
      }
    }

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
        `SELECT r.*, lf.full_name AS facilitator_name, s.full_name AS teacher_name
           FROM daily_reports r
           LEFT JOIN staff lf ON lf.id = r.lead_facilitator_id
           LEFT JOIN staff s ON s.id = r.created_by
          WHERE r.child_id = $1 AND r.status = 'published' AND r.deleted_at IS NULL
          ORDER BY r.report_date DESC LIMIT 1`,
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
        `SELECT p.id, p.photo_url AS url, p.caption, p.media_type, p.poster_url, r.report_date FROM daily_report_photos p
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
    const wali = childId
      ? await query<{ full_name: string }>(
          `SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
            WHERE cg.child_id = $1 ORDER BY cg.is_primary DESC NULLS LAST LIMIT 1`,
          [childId]
        )
      : [];

    return NextResponse.json({
      ok: true,
      preview,
      guardian_name: wali[0]?.full_name || null,
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
  const denied = await guard("events.rsvp");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      kind: string;
      child_id: string;
      event_id?: string;
      guardian_id?: string;
      response?: string;
    };
    // Mode pratinjau hanya baca: aksi orang tua tidak boleh benar-benar terkirim.
    if ((body as { preview?: boolean }).preview) {
      return NextResponse.json(
        { ok: false, error: "Mode pratinjau hanya baca — aksi orang tua tidak dikirim." },
        { status: 403 }
      );
    }
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
