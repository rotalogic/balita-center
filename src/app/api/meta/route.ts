import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Data master minimum agar aplikasi bisa dipakai dari database kosong:
// cabang, program, kelas, dan staf dibuat lewat endpoint ini (formulir Data Awal).
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const [branches, programs, classes, staff, materials, milestones, materialMilestones] = await Promise.all([
      query("SELECT id, code, name FROM branches WHERE deleted_at IS NULL ORDER BY name"),
      query("SELECT id, code, name, monthly_fee FROM programs WHERE deleted_at IS NULL ORDER BY name"),
      query("SELECT id, branch_id, program_id, name FROM classes WHERE deleted_at IS NULL ORDER BY name"),
      query("SELECT id, branch_id, full_name, position FROM staff WHERE deleted_at IS NULL ORDER BY full_name"),
      // Katalog Montessori AMI + milestone untuk pemilih di editor laporan.
      query("SELECT id, name, name_en, area, age_group FROM materials WHERE is_active ORDER BY area, name"),
      query("SELECT id, indikator, age_group, aspect, montessori_area, status FROM milestones WHERE status <> 'arsip' ORDER BY age_group, indikator"),
      query("SELECT material_id, milestone_id FROM material_milestones"),
    ]);
    return NextResponse.json({ ok: true, branches, programs, classes, staff, materials, milestones, materialMilestones });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("branches.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, string>;
    const kind = body.kind;
    if (kind === "branch") {
      if (!body.code || !body.name) return NextResponse.json({ ok: false, error: "Kode dan nama cabang wajib diisi." }, { status: 400 });
      const rows = await query("INSERT INTO branches (code, name, city) VALUES ($1,$2,$3) RETURNING id, code, name", [body.code, body.name, body.city || null]);
      return NextResponse.json({ ok: true, item: rows[0] });
    }
    if (kind === "program") {
      if (!body.code || !body.name) return NextResponse.json({ ok: false, error: "Kode dan nama program wajib diisi." }, { status: 400 });
      const rows = await query(
        "INSERT INTO programs (code, name, monthly_fee, screening_fee) VALUES ($1,$2,$3,$4) RETURNING id, code, name",
        [body.code, body.name, body.monthly_fee ? Number(body.monthly_fee) : null, body.screening_fee ? Number(body.screening_fee) : null]
      );
      return NextResponse.json({ ok: true, item: rows[0] });
    }
    if (kind === "class") {
      if (!body.branch_id || !body.program_id || !body.name) return NextResponse.json({ ok: false, error: "Cabang, program, dan nama kelas wajib diisi." }, { status: 400 });
      const rows = await query(
        "INSERT INTO classes (branch_id, program_id, name) VALUES ($1,$2,$3) RETURNING id, branch_id, program_id, name",
        [body.branch_id, body.program_id, body.name]
      );
      return NextResponse.json({ ok: true, item: rows[0] });
    }
    if (kind === "staff") {
      if (!body.branch_id || !body.full_name || !body.position) return NextResponse.json({ ok: false, error: "Cabang, nama, dan jabatan staf wajib diisi." }, { status: 400 });
      const rows = await query(
        "INSERT INTO staff (branch_id, full_name, position, phone, email) VALUES ($1,$2,$3,$4,$5) RETURNING id, branch_id, full_name, position",
        [body.branch_id, body.full_name, body.position, body.phone || null, body.email || null]
      );
      return NextResponse.json({ ok: true, item: rows[0] });
    }
    return NextResponse.json({ ok: false, error: "Jenis data awal tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
