import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { rapikanLead } from "@/lib/lead";

export const dynamic = "force-dynamic";

const STAGES = [
  "lead_masuk",
  "dihubungi",
  "trial_terjadwal",
  "trial_selesai",
  "diterima",
  "ditolak",
  "terdaftar",
] as const;

export async function GET() {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const leads = await query(
      `SELECT l.*, p.name AS program_name, b.name AS branch_name,
              c.full_name AS converted_child_name
         FROM leads l
         LEFT JOIN programs p ON p.id = l.interested_program_id
         LEFT JOIN branches b ON b.id = l.branch_id
         LEFT JOIN children c ON c.id = l.converted_child_id
        WHERE ($1::uuid[] IS NULL OR l.branch_id = ANY($1::uuid[]))
        ORDER BY l.created_at DESC
        LIMIT 300`,
      [scope]
    );
    const counts = await query<{ stage: string; total: number }>(
      `SELECT stage, COUNT(*)::int AS total FROM leads
        WHERE ($1::uuid[] IS NULL OR branch_id = ANY($1::uuid[]))
        GROUP BY stage`,
      [scope]
    );
    const programs = await query("SELECT id, name, monthly_fee FROM programs ORDER BY name");
    const branches = await query("SELECT id, name FROM branches ORDER BY name");

    const perStage: Record<string, number> = {};
    for (const stage of STAGES) perStage[stage] = 0;
    for (const row of counts) perStage[row.stage] = row.total;

    return NextResponse.json({ ok: true, leads, counts: perStage, programs, branches });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      parent_name?: string;
      child_name?: string;
      wa_number?: string;
      child_age_months?: number | string;
      branch_id?: string;
      interested_program_id?: string;
      notes?: string;
      source?: string;
    };

    const wa = (body.wa_number || "").replace(/[^\d+]/g, "");
    // Nama orang tua dan anak tidak boleh tertukar, usia tidak menempel di nama.
    const rapi = rapikanLead(body.parent_name, body.child_name, body.child_age_months);
    const parent = rapi.parent_name || "";
    const child = rapi.child_name || "";

    if (parent.length < 2 || child.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Nama orang tua dan nama anak wajib diisi minimal 2 karakter." },
        { status: 400 }
      );
    }
    if (wa.length < 8) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp tidak valid." }, { status: 400 });
    }

    const duplikat = await query<{ id: string }>(
      "SELECT id FROM leads WHERE wa_number = $1 AND stage NOT IN ('ditolak') LIMIT 1",
      [wa]
    );
    if (duplikat.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Nomor WhatsApp ini sudah ada di pipeline.", existing_id: duplikat[0].id },
        { status: 409 }
      );
    }

    const umur = rapi.child_age_months;

    const rows = await query<{ id: string }>(
      `INSERT INTO leads (wa_number, parent_name, child_name, child_age_months, branch_id,
                          interested_program_id, source, bot_status, stage, notes,
                          perlu_tinjau, tinjau_alasan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'baru','lead_masuk',$8,$9,$10) RETURNING id`,
      [
        wa,
        parent,
        child,
        umur,
        body.branch_id || null,
        body.interested_program_id || null,
        body.source || "manual",
        body.notes || null,
        rapi.perlu_tinjau,
        rapi.alasan,
      ]
    );

    await catatAudit(denied.user, {
      action: "admission.create",
      entityTable: "leads",
      entityId: rows[0].id,
      branchId: body.branch_id || null,
      detail: { nama: child || parent || null, orang_tua: parent || null, usia_bulan: umur, tahap: "lead_masuk", sumber: body.source || "manual" },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan lead.") }, { status: 500 });
  }
}
