import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { hitungSemua } from "@/lib/trial-hitung";

export const dynamic = "force-dynamic";

type FormRow = Record<string, unknown> & {
  id: string;
  lead_id: string;
  child_birth_date: string | null;
  program_pilihan: string | null;
  arah_rekomendasi: string | null;
};

async function ambilForm(id: string) {
  const rows = await query<FormRow>(
    `SELECT f.*, l.child_name, l.parent_name, l.wa_number, l.child_age_months,
            l.stage AS lead_stage, l.converted_child_id
       FROM trial_forms f JOIN leads l ON l.id = f.lead_id
      WHERE f.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const form = await ambilForm(params.id);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Formulir Trial tidak ditemukan." }, { status: 404 });
    }
    const accLog = await query(
      "SELECT * FROM trial_acc_log WHERE trial_form_id = $1 ORDER BY created_at ASC",
      [params.id]
    );
    return NextResponse.json({ ok: true, form, acc_log: accLog });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// PATCH: perbarui isian (filter dihitung ulang), beri ACC, atau catat Discovery.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const form = await ambilForm(params.id);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Formulir Trial tidak ditemukan." }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    // --- ACC arah oleh guru program terkait ---
    if (body.aksi === "acc") {
      const keputusan = body.keputusan === "disetujui_bersyarat" ? "disetujui_bersyarat" : "disetujui";
      const program =
        form.arah_rekomendasi === "SAM" ? "SAM" : "ZKC";
      await query(
        `INSERT INTO trial_acc_log (trial_form_id, oleh_id, oleh_nama, oleh_peran, program, keputusan, catatan)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          params.id,
          denied.user.id,
          denied.user.full_name,
          denied.user.roles.join(", ") || denied.user.role,
          program,
          keputusan,
          body.catatan ? String(body.catatan) : null,
        ]
      );
      await query(
        `UPDATE trial_forms
            SET acc_status = $2, acc_oleh = $3, acc_nama = $4, acc_peran = $5,
                acc_program = $6, acc_at = now(), acc_catatan = $7, updated_at = now()
          WHERE id = $1`,
        [
          params.id,
          keputusan,
          denied.user.id,
          denied.user.full_name,
          denied.user.roles.join(", ") || denied.user.role,
          program,
          body.catatan ? String(body.catatan) : null,
        ]
      );
      await catatAudit(denied.user, {
        action: "admission.trial_form.acc",
        entityTable: "trial_forms",
        entityId: params.id,
        branchId: (form.branch_id as string) || null,
        detail: { program, keputusan, rekomendasi: form.arah_rekomendasi },
      });
      return NextResponse.json({ ok: true, aksi: "acc", program });
    }

    // --- Catatan Discovery (konfirmasi lapangan) ---
    if (body.aksi === "discovery") {
      const status = body.discovery_status === "berbeda" ? "berbeda" : "sesuai";
      if (status === "berbeda" && !String(body.discovery_catatan || "").trim()) {
        return NextResponse.json(
          { ok: false, error: "Hasil Discovery yang berbeda dari formulir wajib disertai alasan." },
          { status: 400 }
        );
      }
      await query(
        "UPDATE trial_forms SET discovery_status = $2, discovery_catatan = $3, updated_at = now() WHERE id = $1",
        [params.id, status, body.discovery_catatan ? String(body.discovery_catatan) : null]
      );
      await catatAudit(denied.user, {
        action: "admission.trial_form.discovery",
        entityTable: "trial_forms",
        entityId: params.id,
        branchId: (form.branch_id as string) || null,
        detail: { status },
      });
      return NextResponse.json({ ok: true, aksi: "discovery" });
    }

    // --- Pembaruan isian: filter dihitung ulang dari gabungan lama + baru ---
    const gabung = { ...form, ...body };
    const pilihan = gabung.program_pilihan === "SAM" ? "SAM" : "ZKC";
    const tanggalLahir = gabung.child_birth_date
      ? String(gabung.child_birth_date).slice(0, 10)
      : null;
    const hasil = hitungSemua({
      tanggalLahir,
      umurFallback: (form.child_age_months as number | null) ?? null,
      pilihan,
      sinyalDukungan: Boolean(gabung.sinyal_dukungan_konsisten),
      samAnak: (gabung.filter_sam_anak as Record<string, unknown>) || null,
      samOrtu: gabung.filter_sam_ortu,
    });
    if (!hasil.arah) {
      return NextResponse.json(
        { ok: false, error: "Umur anak belum diketahui: tanggal lahir dan usia lead sama-sama kosong." },
        { status: 400 }
      );
    }
    const setuju = Boolean(gabung.kesepakatan_awal);
    await query(
      `UPDATE trial_forms SET
         child_birth_date = $2, child_gender = $3, program_pilihan = $4, program_id = $5,
         tujuan_keluarga = $6, sinyal_dukungan_konsisten = $7, sinyal_catatan = $8,
         observasi_awal = $9, riwayat_awal = $10, filter_sam_anak = $11, filter_sam_ortu = $12,
         arah_rekomendasi = $13, arah_keyakinan = $14, arah_alasan = $15, arah_berbeda = $16,
         sam_hasil = $17, sam_alasan = $18,
         kesepakatan_awal = $19,
         kesepakatan_awal_at = CASE WHEN $19 AND kesepakatan_awal_at IS NULL THEN now() ELSE kesepakatan_awal_at END,
         updated_at = now()
       WHERE id = $1`,
      [
        params.id,
        tanggalLahir,
        gabung.child_gender === "perempuan" ? "perempuan" : gabung.child_gender === "laki_laki" ? "laki_laki" : null,
        pilihan,
        gabung.program_id ? String(gabung.program_id) : null,
        gabung.tujuan_keluarga ? String(gabung.tujuan_keluarga) : null,
        Boolean(gabung.sinyal_dukungan_konsisten),
        gabung.sinyal_catatan ? String(gabung.sinyal_catatan) : null,
        JSON.stringify(gabung.observasi_awal || {}),
        JSON.stringify(gabung.riwayat_awal || {}),
        gabung.filter_sam_anak ? JSON.stringify(gabung.filter_sam_anak) : null,
        gabung.filter_sam_ortu ? JSON.stringify(gabung.filter_sam_ortu) : null,
        hasil.arah.rekomendasi,
        hasil.arah.keyakinan,
        hasil.arah.alasan.join("\n"),
        hasil.arah.berbeda,
        hasil.sam?.hasil || null,
        hasil.sam ? hasil.sam.alasan.join("\n") : null,
        setuju,
      ]
    );
    // Isian berubah sesudah ACC → ACC kembali menunggu agar guru membaca ulang.
    if (form.acc_status && form.acc_status !== "menunggu") {
      await query(
        "UPDATE trial_forms SET acc_status = 'menunggu', updated_at = now() WHERE id = $1",
        [params.id]
      );
    }
    await catatAudit(denied.user, {
      action: "admission.trial_form.update",
      entityTable: "trial_forms",
      entityId: params.id,
      branchId: (form.branch_id as string) || null,
      detail: { rekomendasi: hasil.arah.rekomendasi, hasil_sam: hasil.sam?.hasil || null },
    });
    return NextResponse.json({ ok: true, umur_bulan: hasil.umurBulan, arah: hasil.arah, sam: hasil.sam });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal memperbarui Formulir Trial.") },
      { status: 500 }
    );
  }
}
