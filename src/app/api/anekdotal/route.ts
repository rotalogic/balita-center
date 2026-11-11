import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { FOKUS_AMATI } from "@/lib/segmen";
import { umurBulan } from "@/lib/filter-arah";

export const dynamic = "force-dynamic";

const FOKUS_SAH = new Set<string>(FOKUS_AMATI.map((f) => f.kunci));

// Anekdotal Record SAM — observasi harian lima kolom dengan satu penanda
// Fokus Amati. Internal staf; tidak tampil mentah di Portal Orang Tua.
export async function GET(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const childId = (searchParams.get("child_id") || "").trim();
    const tanggal = (searchParams.get("tanggal") || "").trim();
    const scopeIds = branchScope(denied.user);
    const where: string[] = [];
    const params: unknown[] = [];
    if (scopeIds) {
      params.push(scopeIds);
      where.push(`c.branch_id = ANY($${params.length}::uuid[])`);
    }
    if (childId) { params.push(childId); where.push(`a.child_id = $${params.length}`); }
    if (tanggal) { params.push(tanggal); where.push(`a.tanggal = $${params.length}`); }
    const rows = await query(
      `SELECT a.*, c.full_name AS child_name, c.birth_date AS child_birth_date,
              u.full_name AS penulis_nama
         FROM anekdotal_records a
         JOIN children c ON c.id = a.child_id
         LEFT JOIN users u ON u.id = a.created_by
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY a.tanggal DESC, a.created_at DESC
        LIMIT 200`,
      params
    );
    const denganUsia = rows.map((r) => ({
      ...r,
      usia_bulan: r.child_birth_date ? umurBulan(String(r.child_birth_date), new Date(String(r.tanggal).slice(0, 10))) : null,
    }));
    return NextResponse.json({ ok: true, anekdotal: denganUsia });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const childId = String(body.child_id || "");
    const tanggal = String(body.tanggal || "").slice(0, 10);
    const fokus = String(body.fokus_amati || "");
    const kejadian = String(body.kejadian || "").trim();
    const interpretasi = String(body.interpretasi || "").trim();
    const tindakLanjut = String(body.tindak_lanjut || "").trim();
    if (!childId || !tanggal) {
      return NextResponse.json({ ok: false, error: "Anak dan tanggal wajib dipilih." }, { status: 400 });
    }
    if (!FOKUS_SAH.has(fokus)) {
      return NextResponse.json({ ok: false, error: "Pilih satu penanda Fokus Amati." }, { status: 400 });
    }
    if (!kejadian || !interpretasi || !tindakLanjut) {
      return NextResponse.json(
        { ok: false, error: "Lima kolom wajib lengkap: kejadian faktual, interpretasi bahasa Montessori, dan tindak lanjut konkret." },
        { status: 400 }
      );
    }
    const anak = await query<{ branch_id: string }>(
      "SELECT branch_id FROM children WHERE id = $1",
      [childId]
    );
    if (anak.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }
    const scopeIds = branchScope(denied.user);
    if (scopeIds && !scopeIds.includes(anak[0].branch_id)) {
      return NextResponse.json({ ok: false, error: "Anak di luar cakupan cabang Anda." }, { status: 403 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO anekdotal_records (branch_id, child_id, tanggal, fokus_amati, kejadian, interpretasi, tindak_lanjut, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [anak[0].branch_id, childId, tanggal, fokus, kejadian, interpretasi, tindakLanjut, denied.user.id]
    );
    await catatAudit(denied.user, {
      action: "anekdotal.create",
      entityTable: "anekdotal_records",
      entityId: rows[0].id,
      branchId: anak[0].branch_id,
      detail: { anak: childId, tanggal, fokus },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
