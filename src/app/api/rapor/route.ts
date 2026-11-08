import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PILIH =
  `SELECT cr.*, c.full_name AS child_name, lc.theme AS cycle_theme,
          lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
          s.full_name AS teacher_name, b.name AS branch_name
     FROM cycle_reports cr
     JOIN children c ON c.id = cr.child_id
     JOIN learning_cycles lc ON lc.id = cr.cycle_id
     JOIN branches b ON b.id = cr.branch_id
     LEFT JOIN staff s ON s.id = cr.created_by`;

// Daftar rapor periodik untuk staf.
export async function GET(request: Request) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get("child_id");
    const scope = branchScope(denied.user);
    const rows = await query(
      `${PILIH}
        WHERE ($1::uuid IS NULL OR cr.child_id = $1::uuid)
          AND ($2::uuid[] IS NULL OR cr.branch_id = ANY($2::uuid[]))
        ORDER BY lc.end_date DESC, c.full_name
        LIMIT 200`,
      [childId || null, scope]
    );
    return NextResponse.json({ ok: true, reports: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Buat draft rapor baru untuk satu anak pada satu siklus.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { child_id?: string; cycle_id?: string; created_by?: string };
    if (!body.child_id || !body.cycle_id || !body.created_by) {
      return NextResponse.json(
        { ok: false, error: "Anak, siklus, dan guru pembuat wajib dipilih." },
        { status: 400 }
      );
    }
    const anak = await query<{ branch_id: string }>("SELECT branch_id FROM children WHERE id = $1 AND deleted_at IS NULL", [body.child_id]);
    if (anak.length === 0) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    const siklus = await query<{ id: string }>("SELECT id FROM learning_cycles WHERE id = $1", [body.cycle_id]);
    if (siklus.length === 0) return NextResponse.json({ ok: false, error: "Siklus tidak ditemukan." }, { status: 404 });

    const duplikat = await query<{ id: string }>(
      "SELECT id FROM cycle_reports WHERE child_id = $1 AND cycle_id = $2",
      [body.child_id, body.cycle_id]
    );
    if (duplikat.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Rapor anak ini untuk siklus tersebut sudah ada.", existing_id: duplikat[0].id },
        { status: 409 }
      );
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO cycle_reports (branch_id, child_id, cycle_id, status, created_by)
       VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
      [anak[0].branch_id, body.child_id, body.cycle_id, body.created_by]
    );
    await catatAudit(denied.user, {
      action: "rapor.dibuat",
      entityTable: "cycle_reports",
      entityId: rows[0].id,
      branchId: anak[0].branch_id,
      detail: { child_id: body.child_id, cycle_id: body.cycle_id },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
