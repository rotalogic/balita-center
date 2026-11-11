import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { hitungSemua } from "@/lib/trial-hitung";

export const dynamic = "force-dynamic";

type LeadRingkas = {
  id: string;
  child_name: string | null;
  parent_name: string | null;
  child_age_months: number | null;
  branch_id: string | null;
  stage: string;
};

export async function GET() {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const forms = await query(
      `SELECT f.*, l.child_name, l.parent_name, l.wa_number, l.stage AS lead_stage,
              l.converted_child_id
         FROM trial_forms f
         JOIN leads l ON l.id = f.lead_id
        WHERE ($1::uuid[] IS NULL OR f.branch_id = ANY($1::uuid[]) OR l.branch_id = ANY($1::uuid[]))
        ORDER BY f.updated_at DESC
        LIMIT 300`,
      [scope]
    );
    return NextResponse.json({ ok: true, forms });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const leadId = String(body.lead_id || "");
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Lead wajib dipilih." }, { status: 400 });
    }
    const leads = await query<LeadRingkas>("SELECT * FROM leads WHERE id = $1", [leadId]);
    const lead = leads[0];
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead tidak ditemukan." }, { status: 404 });
    }
    const sudah = await query<{ id: string }>("SELECT id FROM trial_forms WHERE lead_id = $1", [leadId]);
    if (sudah.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Lead ini sudah memiliki Formulir Trial.", existing_id: sudah[0].id },
        { status: 409 }
      );
    }

    const pilihan = body.program_pilihan === "SAM" ? "SAM" : "ZKC";
    const tanggalLahir = body.child_birth_date ? String(body.child_birth_date).slice(0, 10) : null;
    const hasil = hitungSemua({
      tanggalLahir,
      umurFallback: lead.child_age_months,
      pilihan,
      sinyalDukungan: Boolean(body.sinyal_dukungan_konsisten),
      samAnak: (body.filter_sam_anak as Record<string, unknown>) || null,
      samOrtu: body.filter_sam_ortu,
    });
    if (!hasil.arah) {
      return NextResponse.json(
        { ok: false, error: "Umur anak belum diketahui: isi tanggal lahir anak pada formulir atau usia pada lead." },
        { status: 400 }
      );
    }

    const setuju = Boolean(body.kesepakatan_awal);
    const rows = await query<{ id: string }>(
      `INSERT INTO trial_forms
         (lead_id, branch_id, child_birth_date, child_gender, program_pilihan, program_id,
          tujuan_keluarga, sinyal_dukungan_konsisten, sinyal_catatan, observasi_awal, riwayat_awal,
          filter_sam_anak, filter_sam_ortu, arah_rekomendasi, arah_keyakinan, arah_alasan, arah_berbeda,
          sam_hasil, sam_alasan, kesepakatan_awal, kesepakatan_awal_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        leadId,
        lead.branch_id,
        tanggalLahir,
        body.child_gender === "perempuan" ? "perempuan" : body.child_gender === "laki_laki" ? "laki_laki" : null,
        pilihan,
        body.program_id ? String(body.program_id) : null,
        body.tujuan_keluarga ? String(body.tujuan_keluarga) : null,
        Boolean(body.sinyal_dukungan_konsisten),
        body.sinyal_catatan ? String(body.sinyal_catatan) : null,
        JSON.stringify(body.observasi_awal || {}),
        JSON.stringify(body.riwayat_awal || {}),
        body.filter_sam_anak ? JSON.stringify(body.filter_sam_anak) : null,
        body.filter_sam_ortu ? JSON.stringify(body.filter_sam_ortu) : null,
        hasil.arah.rekomendasi,
        hasil.arah.keyakinan,
        hasil.arah.alasan.join("\n"),
        hasil.arah.berbeda,
        hasil.sam?.hasil || null,
        hasil.sam ? hasil.sam.alasan.join("\n") : null,
        setuju,
        setuju ? new Date().toISOString() : null,
        denied.user.id,
      ]
    );

    // Lead bergerak ke tahap formulir & triase.
    if (lead.stage === "inquiry") {
      await query("UPDATE leads SET stage = 'formulir_triase', updated_at = now() WHERE id = $1", [leadId]);
    }

    await catatAudit(denied.user, {
      action: "admission.trial_form.create",
      entityTable: "trial_forms",
      entityId: rows[0].id,
      branchId: lead.branch_id,
      detail: {
        anak: lead.child_name,
        pilihan_ortu: pilihan,
        rekomendasi: hasil.arah.rekomendasi,
        keyakinan: hasil.arah.keyakinan,
        hasil_sam: hasil.sam?.hasil || null,
      },
    });
    return NextResponse.json({
      ok: true,
      id: rows[0].id,
      umur_bulan: hasil.umurBulan,
      arah: hasil.arah,
      sam: hasil.sam,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal menyimpan Formulir Trial.") },
      { status: 500 }
    );
  }
}
