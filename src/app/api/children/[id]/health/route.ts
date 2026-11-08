import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const GIZI_VALID = ["gizi_baik", "gizi_kurang", "gizi_lebih", "obesitas", "stunting"];

const angkaAtauNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

type Body = {
  checked_on?: string;
  weight_kg?: number | string;
  height_cm?: number | string;
  head_circumference_cm?: number | string;
  temperature_c?: number | string;
  condition?: string;
  nutrition_status?: string;
  notes?: string;
  checked_by?: string;
};

// Catat pemeriksaan / pengukuran anak (berat, tinggi, lingkar kepala, suhu,
// kondisi, status gizi). Data ini mengisi Riwayat Pemeriksaan, halaman
// Kesehatan Balita Connect, dan panel Tumbuh Kembang rapor.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("health.update");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const anak = await query<{ branch_id: string }>(
      "SELECT branch_id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });

    const tanggal = String(body.checked_on || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal pemeriksaan wajib diisi." }, { status: 400 });
    }
    const berat = angkaAtauNull(body.weight_kg);
    const tinggi = angkaAtauNull(body.height_cm);
    const lingkar = angkaAtauNull(body.head_circumference_cm);
    const suhu = angkaAtauNull(body.temperature_c);
    if (berat === null && tinggi === null && lingkar === null && suhu === null && !body.condition) {
      return NextResponse.json(
        { ok: false, error: "Isi minimal satu hasil ukur (berat/tinggi/lingkar kepala/suhu) atau kondisi." },
        { status: 400 }
      );
    }
    if (body.nutrition_status && !GIZI_VALID.includes(body.nutrition_status)) {
      return NextResponse.json({ ok: false, error: "Status gizi tidak dikenal." }, { status: 400 });
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO health_checks
         (branch_id, child_id, checked_on, weight_kg, height_cm, head_circumference_cm,
          temperature_c, condition, nutrition_status, notes, checked_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        anak[0].branch_id, params.id, tanggal, berat, tinggi, lingkar, suhu,
        body.condition || null, body.nutrition_status || null, body.notes || null,
        body.checked_by || null,
      ]
    );
    await catatAudit(denied.user, {
      action: "kesehatan.dicatat",
      entityTable: "health_checks",
      entityId: rows[0].id,
      branchId: anak[0].branch_id,
      detail: { child_id: params.id, checked_on: tanggal },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Hapus satu catatan pemeriksaan (untuk membetulkan salah catat).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("health.update");
  if (denied.error) return denied.error;
  try {
    const checkId = new URL(request.url).searchParams.get("check_id");
    if (!checkId) return NextResponse.json({ ok: false, error: "check_id wajib." }, { status: 400 });
    const rows = await query<{ branch_id: string }>(
      "DELETE FROM health_checks WHERE id = $1 AND child_id = $2 RETURNING branch_id",
      [checkId, params.id]
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Catatan tidak ditemukan." }, { status: 404 });
    await catatAudit(denied.user, {
      action: "kesehatan.dihapus",
      entityTable: "health_checks",
      entityId: checkId,
      branchId: rows[0].branch_id,
      detail: { child_id: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
