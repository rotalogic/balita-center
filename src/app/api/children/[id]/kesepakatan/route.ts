import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type StatusKesepakatan = {
  disetujui: boolean;
  nama_penyetuju: string | null;
  disetujui_at: string | null;
  sumber: string | null;
};

// Status Kesepakatan Awal Keluarga seorang anak: dari catatan registrasi,
// atau dari Formulir Trial lead yang terkonversi menjadi anak ini.
async function statusUntuk(childId: string): Promise<StatusKesepakatan> {
  const tercatat = await query<StatusKesepakatan>(
    `SELECT true AS disetujui, nama_penyetuju, disetujui_at, sumber
       FROM kesepakatan_keluarga WHERE child_id = $1`,
    [childId]
  );
  if (tercatat.length > 0) return tercatat[0];
  const dariTrial = await query<StatusKesepakatan>(
    `SELECT true AS disetujui, l.parent_name AS nama_penyetuju,
            f.kesepakatan_awal_at AS disetujui_at, 'trial' AS sumber
       FROM leads l JOIN trial_forms f ON f.lead_id = l.id
      WHERE l.converted_child_id = $1 AND f.kesepakatan_awal`,
    [childId]
  );
  if (dariTrial.length > 0) return dariTrial[0];
  return { disetujui: false, nama_penyetuju: null, disetujui_at: null, sumber: null };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const status = await statusUntuk(params.id);
    return NextResponse.json({ ok: true, kesepakatan: status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Catat persetujuan pada alur registrasi (orang tua menyetujui di tempat /
// dibantu staf dengan nama penyetuju yang jelas).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { nama_penyetuju?: string };
    const nama = String(body.nama_penyetuju || "").trim();
    if (nama.length < 2) {
      return NextResponse.json({ ok: false, error: "Nama orang tua yang menyetujui wajib diisi." }, { status: 400 });
    }
    await query(
      `INSERT INTO kesepakatan_keluarga (child_id, nama_penyetuju, sumber, dicatat_oleh)
       VALUES ($1,$2,'registrasi',$3)
       ON CONFLICT (child_id) DO UPDATE SET nama_penyetuju = EXCLUDED.nama_penyetuju,
         disetujui_at = now(), dicatat_oleh = EXCLUDED.dicatat_oleh`,
      [params.id, nama, denied.user.id]
    );
    await catatAudit(denied.user, {
      action: "anak.kesepakatan_awal",
      entityTable: "kesepakatan_keluarga",
      entityId: params.id,
      detail: { penyetuju: nama },
    });
    const status = await statusUntuk(params.id);
    return NextResponse.json({ ok: true, kesepakatan: status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal mencatat kesepakatan.") },
      { status: 500 }
    );
  }
}
