import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { umurBulan } from "@/lib/filter-arah";

export const dynamic = "force-dynamic";

const JENIS_KEGIATAN: Record<string, string> = {
  zkc: "Kegiatan Ziel Kids Club",
  sam: "Kegiatan Sekolah Alam Montessori",
  pop_up: "Pop Up Class",
  event_alam: "Event Alam",
  edukasi: "Acara Edukasi",
};

export async function GET() {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT i.*, c.full_name AS nama_anggota,
              EXISTS (SELECT 1 FROM insidentil_paket p WHERE p.insidentil_id = i.id AND p.dikirim_at IS NOT NULL) AS paket_terkirim
         FROM insidentil i
         LEFT JOIN children c ON c.id = i.child_id
        WHERE ($1::uuid[] IS NULL OR i.branch_id = ANY($1::uuid[]))
        ORDER BY i.tanggal DESC, i.created_at DESC
        LIMIT 300`,
      [scope]
    );
    return NextResponse.json({ ok: true, insidentil: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const namaAnak = String(body.child_name || "").trim();
    const namaOrtu = String(body.parent_name || "").trim();
    const wa = String(body.wa_number || "").replace(/[^\d+]/g, "");
    let jenis = String(body.kegiatan_jenis || "");
    let tanggal = String(body.tanggal || "");
    let edisiId: string | null = null;
    let tarifJenis: string | null = null;
    let biayaEdisi: number | null = null;
    let labelEdisi: string | null = null;

    if (namaAnak.length < 2 || namaOrtu.length < 2) {
      return NextResponse.json({ ok: false, error: "Nama anak dan nama orang tua wajib diisi." }, { status: 400 });
    }
    if (wa.length < 8) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp orang tua tidak valid." }, { status: 400 });
    }

    // Pendaftaran lewat edisi Program Event: mendarat sebagai peserta edisi,
    // mengurangi sisa kuota secara nyata, dan mengikuti kaidah edisi —
    // pendaftaran hanya saat edisi Buka dan HTM sudah ditetapkan.
    if (body.event_edisi_id) {
      edisiId = String(body.event_edisi_id);
      const edisi = await query<{
        jenis: string; status: string; kuota: number | null; tanggal: string | null;
        htm_reguler: string | null; htm_early_bird: string | null; nama: string; branch_id: string;
      }>(
        "SELECT jenis, status, kuota, tanggal::text AS tanggal, htm_reguler, htm_early_bird, nama, branch_id FROM event_edisi WHERE id = $1",
        [edisiId]
      );
      if (edisi.length === 0) {
        return NextResponse.json({ ok: false, error: "Edisi event tidak ditemukan." }, { status: 400 });
      }
      const e = edisi[0];
      if (e.status !== "buka") {
        return NextResponse.json(
          { ok: false, error: `Pendaftaran edisi ini ${e.status === "tutup" ? "sedang Tutup" : "belum dibuka"} (status: ${e.status}).` },
          { status: 400 }
        );
      }
      if (e.htm_reguler === null && e.htm_early_bird === null) {
        return NextResponse.json(
          { ok: false, error: "HTM edisi ini belum ditetapkan — pendaftaran tetap Tutup sampai admin menetapkan HTM." },
          { status: 400 }
        );
      }
      if (e.kuota !== null) {
        const terisi = await query<{ n: string }>(
          "SELECT count(*)::text AS n FROM insidentil WHERE event_edisi_id = $1 AND status <> 'batal'",
          [edisiId]
        );
        if (Number(terisi[0]?.n || 0) >= e.kuota) {
          return NextResponse.json({ ok: false, error: "Kuota edisi ini sudah penuh." }, { status: 400 });
        }
      }
      jenis =
        e.jenis === "pop_up" ? "pop_up"
        : e.jenis === "event_alam" || e.jenis === "barefoot" ? "event_alam"
        : e.jenis === "holiday_camp" ? "zkc"
        : "edukasi";
      if (e.tanggal) tanggal = e.tanggal;
      tarifJenis = body.tarif_jenis === "early_bird" && e.htm_early_bird !== null ? "early_bird" : "reguler";
      biayaEdisi = Number(tarifJenis === "early_bird" ? e.htm_early_bird : e.htm_reguler) || null;
      labelEdisi = e.nama;
      if (!body.branch_id) body.branch_id = e.branch_id;
    }

    if (!JENIS_KEGIATAN[jenis]) {
      return NextResponse.json({ ok: false, error: "Pilihan kegiatan tidak dikenal." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal kegiatan wajib diisi." }, { status: 400 });
    }

    // Gerbang alergi: rincian alergi ATAU pernyataan tidak ada alergi.
    const alergiTidakAda = Boolean(body.alergi_tidak_ada);
    const alergiJenis = String(body.alergi_jenis || "").trim();
    if (!alergiTidakAda && !alergiJenis) {
      return NextResponse.json(
        { ok: false, error: "Kolom alergi wajib diisi, atau pilih \"Tidak Ada Alergi yang Diketahui\"." },
        { status: 400 }
      );
    }

    // Gerbang kegiatan berbayar: ketentuan tampil + centang wajib (server).
    const berbayar = edisiId ? biayaEdisi !== null : Boolean(body.berbayar);
    const setujuBayar = Boolean(body.setuju_ketentuan_bayar);
    if (berbayar && !setujuBayar) {
      return NextResponse.json(
        { ok: false, error: "Kegiatan berbayar mewajibkan centang persetujuan bahwa pembayaran tidak dapat dibatalkan dan tidak dapat dikembalikan." },
        { status: 400 }
      );
    }

    const tglLahir = body.child_birth_date ? String(body.child_birth_date).slice(0, 10) : null;
    const umur = tglLahir
      ? umurBulan(tglLahir)
      : body.child_age_months !== undefined && body.child_age_months !== ""
        ? Math.max(0, Number(body.child_age_months) || 0)
        : null;

    const rows = await query<{ id: string }>(
      `INSERT INTO insidentil
         (branch_id, child_name, child_birth_date, child_age_months, parent_name, wa_number, email,
          kegiatan_jenis, kegiatan_label, tanggal, berbayar, biaya,
          setuju_ketentuan_bayar, setuju_ketentuan_bayar_at,
          alergi_tidak_ada, alergi_jenis, alergi_pemicu, alergi_reaksi, alergi_tindakan,
          setuju_dokumentasi, catatan, event_edisi_id, tarif_jenis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : null,
        namaAnak,
        tglLahir,
        umur,
        namaOrtu,
        wa,
        body.email ? String(body.email) : null,
        jenis,
        labelEdisi || (body.kegiatan_label ? String(body.kegiatan_label) : null),
        tanggal,
        berbayar,
        edisiId ? biayaEdisi : berbayar && body.biaya ? Number(body.biaya) : null,
        setujuBayar,
        setujuBayar ? new Date().toISOString() : null,
        alergiTidakAda,
        alergiTidakAda ? null : alergiJenis || null,
        alergiTidakAda ? null : body.alergi_pemicu ? String(body.alergi_pemicu) : null,
        alergiTidakAda ? null : body.alergi_reaksi ? String(body.alergi_reaksi) : null,
        alergiTidakAda ? null : body.alergi_tindakan ? String(body.alergi_tindakan) : null,
        Boolean(body.setuju_dokumentasi),
        body.catatan ? String(body.catatan) : null,
        edisiId,
        tarifJenis,
      ]
    );
    await catatAudit(denied.user, {
      action: "admission.insidentil.create",
      entityTable: "insidentil",
      entityId: rows[0].id,
      branchId: body.branch_id ? String(body.branch_id) : null,
      detail: { anak: namaAnak, kegiatan: jenis, tanggal, berbayar, ada_alergi: !alergiTidakAda, edisi: edisiId },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal menyimpan pendaftaran insidentil.") },
      { status: 500 }
    );
  }
}
