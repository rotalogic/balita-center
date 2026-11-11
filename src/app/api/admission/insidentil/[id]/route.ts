import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { NILAI_POP_UP } from "@/lib/skala";

export const dynamic = "force-dynamic";

type InsRow = Record<string, unknown> & {
  id: string; branch_id: string | null; child_name: string; parent_name: string;
  wa_number: string; email: string | null; kegiatan_jenis: string;
  child_birth_date: string | null; status: string; child_id: string | null;
  alergi_tidak_ada: boolean; alergi_jenis: string | null; alergi_pemicu: string | null;
  alergi_reaksi: string | null; alergi_tindakan: string | null;
  setuju_dokumentasi: boolean;
};

async function ambil(id: string): Promise<InsRow | null> {
  const rows = await query<InsRow>("SELECT * FROM insidentil WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const ins = await ambil(params.id);
    if (!ins) {
      return NextResponse.json({ ok: false, error: "Pendaftaran insidentil tidak ditemukan." }, { status: 404 });
    }
    const paket = await query(
      "SELECT * FROM insidentil_paket WHERE insidentil_id = $1 ORDER BY created_at DESC",
      [params.id]
    );
    const branches = await query("SELECT id, name FROM branches ORDER BY name");
    const laporan = await query("SELECT * FROM laporan_ringan WHERE insidentil_id = $1", [params.id]);
    const edisi = ins.event_edisi_id
      ? await query("SELECT id, nama, jenis FROM event_edisi WHERE id = $1", [ins.event_edisi_id as string])
      : [];
    return NextResponse.json({
      ok: true, insidentil: ins, paket, branches,
      laporan_ringan: laporan[0] || null, edisi: edisi[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const ins = await ambil(params.id);
    if (!ins) {
      return NextResponse.json({ ok: false, error: "Pendaftaran insidentil tidak ditemukan." }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    // --- Simpan / perbarui paket edukasi ---
    if (body.aksi === "paket") {
      const wajib = ["kegiatan", "aspek_dilatih", "cara_anak", "ide_rumah"] as const;
      for (const k of wajib) {
        if (!String(body[k] || "").trim()) {
          return NextResponse.json(
            { ok: false, error: "Paket edukasi wajib lengkap: kegiatan, aspek yang dilatih, cara anak menjalaninya, dan satu ide lanjutan di rumah." },
            { status: 400 }
          );
        }
      }
      const paketId = body.paket_id ? String(body.paket_id) : null;
      if (paketId) {
        await query(
          `UPDATE insidentil_paket SET kegiatan = $2, aspek_dilatih = $3, cara_anak = $4, ide_rumah = $5, updated_at = now()
            WHERE id = $1 AND insidentil_id = $6`,
          [paketId, body.kegiatan, body.aspek_dilatih, body.cara_anak, body.ide_rumah, params.id]
        );
        return NextResponse.json({ ok: true, aksi: "paket", id: paketId });
      }
      const rows = await query<{ id: string }>(
        `INSERT INTO insidentil_paket (insidentil_id, kegiatan, aspek_dilatih, cara_anak, ide_rumah)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [params.id, body.kegiatan, body.aspek_dilatih, body.cara_anak, body.ide_rumah]
      );
      return NextResponse.json({ ok: true, aksi: "paket", id: rows[0].id });
    }

    // --- Catat pengiriman paket edukasi (isi & waktu kirim tercatat) ---
    if (body.aksi === "kirim") {
      const paketId = String(body.paket_id || "");
      const saluran = body.saluran === "email" ? "email" : "whatsapp";
      if (!paketId) {
        return NextResponse.json({ ok: false, error: "Paket edukasi belum dipilih." }, { status: 400 });
      }
      await query(
        "UPDATE insidentil_paket SET saluran = $2, dikirim_at = now(), dikirim_oleh = $3 WHERE id = $1 AND insidentil_id = $4",
        [paketId, saluran, denied.user.id, params.id]
      );
      if (ins.status === "baru" || ins.status === "terjadwal") {
        await query("UPDATE insidentil SET status = 'selesai', updated_at = now() WHERE id = $1", [params.id]);
      }
      await catatAudit(denied.user, {
        action: "admission.insidentil.kirim_paket",
        entityTable: "insidentil_paket",
        entityId: paketId,
        branchId: ins.branch_id,
        detail: { anak: ins.child_name, saluran },
      });
      return NextResponse.json({ ok: true, aksi: "kirim", saluran });
    }

    // --- Jadikan anggota: data dasar terbawa menjadi profil anak ---
    if (body.aksi === "convert") {
      if (ins.child_id) {
        return NextResponse.json(
          { ok: false, error: "Peserta ini sudah menjadi anggota.", child_id: ins.child_id },
          { status: 409 }
        );
      }
      const scope = branchScope(denied.user);
      let branchId = body.branch_id ? String(body.branch_id) : ins.branch_id;
      if (!branchId) {
        const cabang = await query<{ id: string }>(
          "SELECT id FROM branches WHERE ($1::uuid[] IS NULL OR id = ANY($1::uuid[])) ORDER BY name LIMIT 1",
          [scope]
        );
        branchId = cabang[0]?.id || null;
      }
      if (!branchId) {
        return NextResponse.json({ ok: false, error: "Cabang wajib ditentukan untuk membuat profil anggota." }, { status: 400 });
      }
      const tglLahir = body.child_birth_date
        ? String(body.child_birth_date).slice(0, 10)
        : ins.child_birth_date
          ? String(ins.child_birth_date).slice(0, 10)
          : null;
      if (!tglLahir) {
        return NextResponse.json(
          { ok: false, error: "Tanggal lahir anak wajib diisi untuk membuat profil anggota." },
          { status: 400 }
        );
      }
      const kategori =
        ins.kegiatan_jenis === "sam" || ins.kegiatan_jenis === "event_alam" ? "SAM" : "ZKC";
      const catatanSehat = ins.alergi_tidak_ada
        ? null
        : [
            `ALERGI: ${ins.alergi_jenis || "-"}`,
            ins.alergi_pemicu ? `Pemicu: ${ins.alergi_pemicu}` : null,
            ins.alergi_reaksi ? `Reaksi: ${ins.alergi_reaksi}` : null,
            ins.alergi_tindakan ? `Tindakan: ${ins.alergi_tindakan}` : null,
          ].filter(Boolean).join(" · ");

      const wali = await query<{ id: string }>(
        "INSERT INTO guardians (full_name, phone, email) VALUES ($1,$2,$3) RETURNING id",
        [ins.parent_name, ins.wa_number, ins.email]
      );
      const anak = await query<{ id: string }>(
        `INSERT INTO children
           (branch_id, full_name, birth_date, photo_consent, health_notes, enrolled_on, status, kategori_program, label_status)
         VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,'aktif',$6,'Anggota') RETURNING id`,
        [branchId, ins.child_name, tglLahir, ins.setuju_dokumentasi, catatanSehat, kategori]
      );
      await query(
        "INSERT INTO child_guardians (child_id, guardian_id, is_primary) VALUES ($1,$2,true)",
        [anak[0].id, wali[0].id]
      );
      await query(
        "UPDATE insidentil SET child_id = $2, status = 'jadi_anggota', updated_at = now() WHERE id = $1",
        [params.id, anak[0].id]
      );
      await catatAudit(denied.user, {
        action: "admission.insidentil.convert",
        entityTable: "children",
        entityId: anak[0].id,
        branchId,
        detail: { dari_insidentil: params.id, anak: ins.child_name, kategori },
      });
      return NextResponse.json({ ok: true, aksi: "convert", child_id: anak[0].id });
    }

    // --- Laporan Ringan Pop Up: tepat enam aspek bernilai kata ---
    if (body.aksi === "laporan_ringan") {
      const aspekIn = Array.isArray(body.aspek) ? (body.aspek as Array<Record<string, unknown>>) : [];
      if (aspekIn.length !== 6) {
        return NextResponse.json(
          { ok: false, error: "Laporan Ringan Pop Up memuat tepat enam aspek." },
          { status: 400 }
        );
      }
      const aspek = aspekIn.map((a) => ({
        label: String(a.label || "").trim(),
        nilai: String(a.nilai || ""),
      }));
      if (aspek.some((a) => !a.label || !(NILAI_POP_UP as readonly string[]).includes(a.nilai))) {
        return NextResponse.json(
          { ok: false, error: "Setiap aspek wajib bernama dan bernilai kata: Bersinar, Muncul, atau Berlatih." },
          { status: 400 }
        );
      }
      await query(
        `INSERT INTO laporan_ringan (insidentil_id, aspek, catatan, created_by)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (insidentil_id) DO UPDATE
           SET aspek = EXCLUDED.aspek, catatan = EXCLUDED.catatan, updated_at = now()`,
        [params.id, JSON.stringify(aspek), body.catatan ? String(body.catatan) : null, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "event.laporan_ringan.simpan", entityTable: "laporan_ringan", entityId: params.id,
        branchId: ins.branch_id, detail: { anak: ins.child_name },
      });
      return NextResponse.json({ ok: true, aksi: "laporan_ringan" });
    }

    // --- Kirim Laporan Ringan (bersama paket dokumentasi edukasi) ---
    if (body.aksi === "kirim_laporan") {
      const saluran = String(body.saluran || "");
      if (!["whatsapp", "email"].includes(saluran)) {
        return NextResponse.json({ ok: false, error: "Saluran kirim tidak dikenal." }, { status: 400 });
      }
      const ada = await query<{ id: string }>("SELECT id FROM laporan_ringan WHERE insidentil_id = $1", [params.id]);
      if (ada.length === 0) {
        return NextResponse.json({ ok: false, error: "Susun dulu Laporan Ringan sebelum mengirim." }, { status: 400 });
      }
      await query(
        "UPDATE laporan_ringan SET saluran = $2, dikirim_at = now(), dikirim_oleh = $3, updated_at = now() WHERE insidentil_id = $1",
        [params.id, saluran, denied.user.id]
      );
      return NextResponse.json({ ok: true, aksi: "kirim_laporan", saluran });
    }

    // --- Jalur closing: peserta event berminat lanjut ke Trial ZKC ---
    if (body.aksi === "closing") {
      if (ins.closing_lead_id) {
        return NextResponse.json({ ok: true, aksi: "closing", lead_id: ins.closing_lead_id, sudah: true });
      }
      const scope = branchScope(denied.user);
      let branchId = ins.branch_id;
      if (!branchId) {
        const bc = await query<{ id: string }>(
          "SELECT id FROM branches WHERE ($1::uuid[] IS NULL OR id = ANY($1::uuid[])) ORDER BY name LIMIT 1",
          [scope]
        );
        branchId = bc[0]?.id || null;
      }
      if (!branchId) {
        return NextResponse.json({ ok: false, error: "Cabang peserta belum jelas — closing belum bisa dibuat." }, { status: 400 });
      }
      const lead = await query<{ id: string }>(
        `INSERT INTO leads (branch_id, parent_name, wa_number, child_name, child_age_months,
                            source, stage, notes)
         VALUES ($1,$2,$3,$4,$5,'event',$6,$7)
         RETURNING id`,
        [
          branchId,
          ins.parent_name,
          ins.wa_number,
          ins.child_name,
          (ins.child_age_months as number | null) ?? null,
          "inquiry",
          `Closing dari Program Event (${ins.kegiatan_label || ins.kegiatan_jenis}) — data dasar terbawa dari Formulir Insidentil${ins.email ? `; email orang tua: ${ins.email}` : ""}.`,
        ]
      );
      await query("UPDATE insidentil SET closing_lead_id = $2, updated_at = now() WHERE id = $1", [
        params.id,
        lead[0].id,
      ]);
      await catatAudit(denied.user, {
        action: "event.closing.lead", entityTable: "leads", entityId: lead[0].id,
        branchId, detail: { dari_insidentil: params.id, anak: ins.child_name },
      });
      return NextResponse.json({ ok: true, aksi: "closing", lead_id: lead[0].id });
    }

    // --- Pembaruan status sederhana ---
    if (body.status !== undefined) {
      const sah = ["baru", "terjadwal", "selesai", "batal"];
      if (!sah.includes(String(body.status))) {
        return NextResponse.json({ ok: false, error: "Status tidak dikenal." }, { status: 400 });
      }
      await query("UPDATE insidentil SET status = $2, updated_at = now() WHERE id = $1", [
        params.id,
        String(body.status),
      ]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Tidak ada aksi atau perubahan dikirim." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal memperbarui pendaftaran insidentil.") },
      { status: 500 }
    );
  }
}
