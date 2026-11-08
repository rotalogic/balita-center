import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ASPEK = [
  "physical_pct", "gross_motor_pct", "fine_motor_pct", "cognitive_pct",
  "language_pct", "social_emotional_pct", "independence_pct",
] as const;

const persenAtauNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

type Body = Record<string, unknown> & {
  recorded_on?: string;
  teacher_notes?: string;
  parent_recommendations?: string;
  recorded_by?: string;
};

// Catat penilaian perkembangan berkala per aspek (0–100%). Mengisi kartu
// Perkembangan Terakhir di profil anak dan halaman Perkembangan Balita Connect.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const anak = await query<{ branch_id: string }>(
      "SELECT branch_id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });

    const tanggal = String(body.recorded_on || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal penilaian wajib diisi." }, { status: 400 });
    }
    const nilai: Record<string, number | null> = {};
    let terisi = 0;
    for (const kolom of ASPEK) {
      const mentah = body[kolom];
      if (mentah !== undefined && mentah !== null && mentah !== "" && persenAtauNull(mentah) === null) {
        return NextResponse.json({ ok: false, error: `Nilai ${kolom} harus bilangan 0–100.` }, { status: 400 });
      }
      nilai[kolom] = persenAtauNull(mentah);
      if (nilai[kolom] !== null) terisi += 1;
    }
    if (terisi === 0) {
      return NextResponse.json({ ok: false, error: "Isi minimal satu aspek perkembangan (0–100%)." }, { status: 400 });
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO child_development_records
         (branch_id, child_id, recorded_on, physical_pct, gross_motor_pct, fine_motor_pct,
          cognitive_pct, language_pct, social_emotional_pct, independence_pct,
          teacher_notes, parent_recommendations, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        anak[0].branch_id, params.id, tanggal,
        nilai.physical_pct, nilai.gross_motor_pct, nilai.fine_motor_pct,
        nilai.cognitive_pct, nilai.language_pct, nilai.social_emotional_pct, nilai.independence_pct,
        body.teacher_notes || null, body.parent_recommendations || null, body.recorded_by || null,
      ]
    );
    await catatAudit(denied.user, {
      action: "perkembangan.dicatat",
      entityTable: "child_development_records",
      entityId: rows[0].id,
      branchId: anak[0].branch_id,
      detail: { child_id: params.id, recorded_on: tanggal, aspek_terisi: terisi },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Hapus satu catatan perkembangan (untuk membetulkan salah nilai).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const recordId = new URL(request.url).searchParams.get("record_id");
    if (!recordId) return NextResponse.json({ ok: false, error: "record_id wajib." }, { status: 400 });
    const rows = await query<{ branch_id: string }>(
      "DELETE FROM child_development_records WHERE id = $1 AND child_id = $2 RETURNING branch_id",
      [recordId, params.id]
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Catatan tidak ditemukan." }, { status: 404 });
    await catatAudit(denied.user, {
      action: "perkembangan.dihapus",
      entityTable: "child_development_records",
      entityId: recordId,
      branchId: rows[0].branch_id,
      detail: { child_id: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
