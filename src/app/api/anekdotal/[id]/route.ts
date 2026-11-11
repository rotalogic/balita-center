import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { FOKUS_AMATI } from "@/lib/segmen";

export const dynamic = "force-dynamic";

const FOKUS_SAH = new Set<string>(FOKUS_AMATI.map((f) => f.kunci));

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const lama = await query<{ branch_id: string | null }>(
      "SELECT branch_id FROM anekdotal_records WHERE id = $1",
      [params.id]
    );
    if (lama.length === 0) {
      return NextResponse.json({ ok: false, error: "Catatan anekdotal tidak ditemukan." }, { status: 404 });
    }
    const scopeIds = branchScope(denied.user);
    if (scopeIds && lama[0].branch_id && !scopeIds.includes(lama[0].branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const fokus = String(body.fokus_amati || "");
    if (body.fokus_amati && !FOKUS_SAH.has(fokus)) {
      return NextResponse.json({ ok: false, error: "Penanda Fokus Amati tidak dikenal." }, { status: 400 });
    }
    await query(
      `UPDATE anekdotal_records
          SET fokus_amati = COALESCE(NULLIF($2,''), fokus_amati),
              kejadian = COALESCE(NULLIF($3,''), kejadian),
              interpretasi = COALESCE(NULLIF($4,''), interpretasi),
              tindak_lanjut = COALESCE(NULLIF($5,''), tindak_lanjut),
              updated_at = now()
        WHERE id = $1`,
      [
        params.id,
        fokus,
        String(body.kejadian || "").trim(),
        String(body.interpretasi || "").trim(),
        String(body.tindak_lanjut || "").trim(),
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const lama = await query<{ branch_id: string | null; child_id: string }>(
      "SELECT branch_id, child_id FROM anekdotal_records WHERE id = $1",
      [params.id]
    );
    if (lama.length === 0) {
      return NextResponse.json({ ok: false, error: "Catatan anekdotal tidak ditemukan." }, { status: 404 });
    }
    const scopeIds = branchScope(denied.user);
    if (scopeIds && lama[0].branch_id && !scopeIds.includes(lama[0].branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    await query("DELETE FROM anekdotal_records WHERE id = $1", [params.id]);
    await catatAudit(denied.user, {
      action: "anekdotal.delete",
      entityTable: "anekdotal_records",
      entityId: params.id,
      branchId: lama[0].branch_id || undefined,
      detail: { anak: lama[0].child_id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
