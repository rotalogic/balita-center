import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { bolehKeuangan, hitungRingkasanEdisi } from "@/lib/event";

export const dynamic = "force-dynamic";

type Edisi = Record<string, unknown> & {
  id: string; branch_id: string; status: string;
  htm_reguler: string | null; htm_early_bird: string | null; persen_bagi_hasil: string;
};

// Detail edisi: data edisi, tabel RAB, daftar peserta, dan ringkasan otomatis
// (angka keuangan hanya untuk founder & manager).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const edisi = await query<Edisi>(
      `SELECT e.*, b.name AS branch_name FROM event_edisi e JOIN branches b ON b.id = e.branch_id
        WHERE e.id = $1 AND ($2::uuid[] IS NULL OR e.branch_id = ANY($2::uuid[]))`,
      [params.id, scope]
    );
    if (edisi.length === 0) {
      return NextResponse.json({ ok: false, error: "Edisi tidak ditemukan." }, { status: 404 });
    }
    const e = edisi[0];
    const [rab, peserta] = await Promise.all([
      query("SELECT * FROM event_rab WHERE edisi_id = $1 ORDER BY sort_order, id", [params.id]),
      query(
        `SELECT i.*, EXISTS (SELECT 1 FROM insidentil_paket p WHERE p.insidentil_id = i.id AND p.dikirim_at IS NOT NULL) AS paket_terkirim,
                EXISTS (SELECT 1 FROM laporan_ringan l WHERE l.insidentil_id = i.id) AS punya_laporan,
                EXISTS (SELECT 1 FROM laporan_ringan l WHERE l.insidentil_id = i.id AND l.dikirim_at IS NOT NULL) AS laporan_terkirim
           FROM insidentil i
          WHERE i.event_edisi_id = $1 AND i.status <> 'batal'
          ORDER BY i.child_name`,
        [params.id]
      ),
    ]);
    const keuangan = bolehKeuangan(denied.user);
    const ringkasan = keuangan
      ? hitungRingkasanEdisi(
          peserta as Array<{ tarif_jenis: string | null; bayar_status: string }>,
          rab as Array<{ rencana: string | number; realisasi: string | number }>,
          Number(e.htm_reguler || 0),
          Number(e.htm_early_bird || 0),
          Number(e.persen_bagi_hasil || 0)
        )
      : null;
    return NextResponse.json({ ok: true, edisi: e, rab, peserta, ringkasan, keuangan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Perbarui edisi, simpan RAB, atau ubah status pembayaran peserta.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const ada = await query<Edisi>(
      "SELECT * FROM event_edisi WHERE id = $1 AND ($2::uuid[] IS NULL OR branch_id = ANY($2::uuid[]))",
      [params.id, scope]
    );
    if (ada.length === 0) {
      return NextResponse.json({ ok: false, error: "Edisi tidak ditemukan." }, { status: 404 });
    }
    const e = ada[0];
    const body = (await request.json()) as Record<string, unknown>;

    if (body.aksi === "rab_simpan") {
      if (!bolehKeuangan(denied.user)) {
        return NextResponse.json({ ok: false, error: "RAB hanya dikelola founder atau manager." }, { status: 403 });
      }
      const baris = Array.isArray(body.rab) ? (body.rab as Array<Record<string, unknown>>) : [];
      await query("DELETE FROM event_rab WHERE edisi_id = $1", [params.id]);
      let urut = 0;
      for (const b of baris) {
        const pos = String(b.pos || "").trim();
        if (!pos) continue;
        urut += 1;
        await query(
          "INSERT INTO event_rab (edisi_id, pos, rencana, realisasi, sort_order) VALUES ($1,$2,$3,$4,$5)",
          [params.id, pos, Number(b.rencana) || 0, Number(b.realisasi) || 0, urut]
        );
      }
      await catatAudit(denied.user, {
        action: "event.rab.update", entityTable: "event_edisi", entityId: params.id, branchId: e.branch_id,
        detail: { pos: urut },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.aksi === "peserta_bayar") {
      if (!bolehKeuangan(denied.user)) {
        return NextResponse.json({ ok: false, error: "Status pembayaran hanya diubah founder atau manager." }, { status: 403 });
      }
      const insidentilId = String(body.insidentil_id || "");
      const status = String(body.bayar_status || "");
      if (!["belum", "lunas"].includes(status)) {
        return NextResponse.json({ ok: false, error: "Status pembayaran tidak dikenal." }, { status: 400 });
      }
      const upd = await query(
        "UPDATE insidentil SET bayar_status = $2 WHERE id = $1 AND event_edisi_id = $3 RETURNING id",
        [insidentilId, status, params.id]
      );
      if (upd.length === 0) {
        return NextResponse.json({ ok: false, error: "Peserta tidak ditemukan pada edisi ini." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Pembaruan data edisi.
    const htmReguler = body.htm_reguler !== undefined
      ? body.htm_reguler === "" || body.htm_reguler === null ? null : Number(body.htm_reguler)
      : e.htm_reguler !== null ? Number(e.htm_reguler) : null;
    const htmEarly = body.htm_early_bird !== undefined
      ? body.htm_early_bird === "" || body.htm_early_bird === null ? null : Number(body.htm_early_bird)
      : e.htm_early_bird !== null ? Number(e.htm_early_bird) : null;
    const statusBaru = body.status !== undefined ? String(body.status) : e.status;
    if (!["rancangan", "buka", "tutup", "selesai"].includes(statusBaru)) {
      return NextResponse.json({ ok: false, error: "Status edisi tidak dikenal." }, { status: 400 });
    }
    if (statusBaru === "buka" && htmReguler === null && htmEarly === null) {
      return NextResponse.json(
        { ok: false, error: "HTM belum ditetapkan — edisi tidak dapat dibuka. Tetapkan HTM terlebih dahulu (kaidah Holiday Camp)." },
        { status: 400 }
      );
    }
    await query(
      `UPDATE event_edisi SET
         nama = COALESCE($2, nama), tema = $3, tanggal = $4, kuota = $5,
         htm_reguler = $6, htm_early_bird = $7, persen_bagi_hasil = $8, status = $9,
         proposal_url = $10, rundown = $11, surat_ref = $12, catatan = $13, updated_at = now()
       WHERE id = $1`,
      [
        params.id,
        body.nama ? String(body.nama) : null,
        body.tema !== undefined ? (body.tema ? String(body.tema) : null) : e.tema,
        body.tanggal !== undefined ? (body.tanggal ? String(body.tanggal).slice(0, 10) : null) : e.tanggal,
        body.kuota !== undefined ? (body.kuota === "" || body.kuota === null ? null : Math.max(0, Number(body.kuota) || 0)) : e.kuota,
        htmReguler,
        htmEarly,
        body.persen_bagi_hasil !== undefined ? Number(body.persen_bagi_hasil) || 0 : Number(e.persen_bagi_hasil || 0),
        statusBaru,
        body.proposal_url !== undefined ? (body.proposal_url ? String(body.proposal_url) : null) : e.proposal_url,
        body.rundown !== undefined ? (body.rundown ? String(body.rundown) : null) : e.rundown,
        body.surat_ref !== undefined ? (body.surat_ref ? String(body.surat_ref) : null) : e.surat_ref,
        body.catatan !== undefined ? (body.catatan ? String(body.catatan) : null) : e.catatan,
      ]
    );
    await catatAudit(denied.user, {
      action: "event.edisi.update", entityTable: "event_edisi", entityId: params.id, branchId: e.branch_id,
      detail: { status: statusBaru },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui edisi.") }, { status: 500 });
  }
}
