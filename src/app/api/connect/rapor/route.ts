import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { agregatRapor } from "@/lib/rapor";

export const dynamic = "force-dynamic";

// Rapor periodik terbit terbaru untuk Balita Connect. Orang tua hanya bisa
// membuka rapor anak yang terhubung ke akunnya (guardians.email); staf
// berwenang global boleh memilih anak untuk pratinjau.
export async function GET(request: Request) {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  const user = denied.user;
  try {
    const { searchParams } = new URL(request.url);
    let childId = searchParams.get("child_id");

    const globalViewer = [...user.roles, user.role].some((role) =>
      ["super_admin", "owner", "kepala_sekolah"].includes(role)
    );

    if (!globalViewer) {
      const milik = await query<{ id: string }>(
        `SELECT c.id FROM children c
           JOIN child_guardians cg ON cg.child_id = c.id
           JOIN guardians g ON g.id = cg.guardian_id
          WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL
          ORDER BY c.full_name`,
        [user.email]
      );
      const allowed = milik.map((row) => row.id);
      if (allowed.length === 0) {
        return NextResponse.json({ ok: true, report: null, message: "Akun Anda belum terhubung ke data anak." });
      }
      if (!childId) childId = allowed[0];
      else if (!allowed.includes(childId)) {
        return NextResponse.json({ ok: false, error: "Anda tidak berhak melihat rapor anak ini." }, { status: 403 });
      }
    }

    if (!childId) {
      const first = await query<{ id: string }>(
        "SELECT id FROM children WHERE deleted_at IS NULL ORDER BY full_name LIMIT 1"
      );
      if (first.length === 0) return NextResponse.json({ ok: true, report: null });
      childId = first[0].id;
    }

    const rows = await query<Record<string, unknown> & { cycle_start: string; cycle_end: string }>(
      `SELECT cr.*, c.full_name AS child_name, lc.theme AS cycle_theme,
              lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
              s.full_name AS teacher_name, s.photo_url AS teacher_photo, s.signature_url AS teacher_ttd, b.name AS branch_name,
              (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
                WHERE e.child_id = c.id AND e.status = 'aktif'
                ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name
         FROM cycle_reports cr
         JOIN children c ON c.id = cr.child_id
         JOIN learning_cycles lc ON lc.id = cr.cycle_id
         JOIN branches b ON b.id = cr.branch_id
         LEFT JOIN staff s ON s.id = cr.created_by
        WHERE cr.child_id = $1 AND cr.status = 'published'
        ORDER BY lc.end_date DESC LIMIT 1`,
      [childId]
    );
    if (rows.length === 0) return NextResponse.json({ ok: true, report: null });
    const report = rows[0];
    const agregat = await agregatRapor(childId, report.cycle_start, report.cycle_end, String(report.id));
    return NextResponse.json({ ok: true, report, agregat });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Tanggapan dan masukan orang tua atas rapor terbit anaknya — menjadi bagian
// rapor (Modul Rapor). Hanya wali anak itu, hanya rapor berstatus published.
export async function POST(request: Request) {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  const user = denied.user;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tanggapan = String(body.tanggapan || "").trim();
    if (tanggapan.length < 3) {
      return NextResponse.json({ ok: false, error: "Tanggapan terlalu singkat." }, { status: 400 });
    }
    const milik = await query<{ id: string }>(
      `SELECT c.id FROM children c
         JOIN child_guardians cg ON cg.child_id = c.id
         JOIN guardians g ON g.id = cg.guardian_id
        WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL`,
      [user.email]
    );
    const allowed = milik.map((r) => r.id);
    const childId = body.child_id ? String(body.child_id) : allowed[0];
    if (!childId || !allowed.includes(childId)) {
      return NextResponse.json({ ok: false, error: "Anda tidak berhak menanggapi rapor anak ini." }, { status: 403 });
    }
    const target = await query<{ id: string }>(
      `SELECT cr.id FROM cycle_reports cr JOIN learning_cycles lc ON lc.id = cr.cycle_id
        WHERE cr.child_id = $1 AND cr.status = 'published'
        ORDER BY lc.end_date DESC LIMIT 1`,
      [childId]
    );
    if (target.length === 0) {
      return NextResponse.json({ ok: false, error: "Belum ada rapor terbit untuk ditanggapi." }, { status: 404 });
    }
    await query(
      "UPDATE cycle_reports SET tanggapan_ortu = $2, tanggapan_at = now() WHERE id = $1",
      [target[0].id, tanggapan]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
