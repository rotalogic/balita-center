import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const STAGES = [
  "inquiry",
  "formulir_triase",
  "penjadwalan",
  "trial_discovery",
  "wawancara",
  "sesi_hasil",
  "registrasi_orientasi",
  "baseline",
  "tidak_lanjut",
];

// Pindahkan tahap lead, jadwalkan trial, atau simpan catatan.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { stage?: string; trial_at?: string | null; notes?: string };

    if (body.stage !== undefined && !STAGES.includes(body.stage)) {
      return NextResponse.json(
        { ok: false, error: `Tahap harus salah satu: ${STAGES.join(", ")}.` },
        { status: 400 }
      );
    }

    const current = await query<{ id: string; converted_child_id: string | null }>(
      "SELECT id, converted_child_id FROM leads WHERE id = $1",
      [params.id]
    );
    if (current.length === 0) {
      return NextResponse.json({ ok: false, error: "Lead tidak ditemukan." }, { status: 404 });
    }

    const values: unknown[] = [params.id];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.stage !== undefined) add("stage", body.stage);
    if (body.trial_at !== undefined) add("trial_at", body.trial_at || null);
    if (body.notes !== undefined) add("notes", body.notes || null);

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada perubahan dikirim." }, { status: 400 });
    }

    await query(`UPDATE leads SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
