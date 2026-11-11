import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { JENIS_EVENT, bolehKeuangan } from "@/lib/event";

export const dynamic = "force-dynamic";

const JENIS_SAH = new Set(JENIS_EVENT.map(([k]) => k));

// Daftar edisi Program Event beserta jumlah peserta terdaftar.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT e.*, b.name AS branch_name,
              (SELECT count(*)::int FROM insidentil i WHERE i.event_edisi_id = e.id AND i.status <> 'batal') AS peserta
         FROM event_edisi e JOIN branches b ON b.id = e.branch_id
        WHERE ($1::uuid[] IS NULL OR e.branch_id = ANY($1::uuid[]))
        ORDER BY e.tanggal DESC NULLS LAST, e.created_at DESC
        LIMIT 200`,
      [scope]
    );
    return NextResponse.json({ ok: true, edisi: rows, keuangan: bolehKeuangan(denied.user) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Buat edisi. Kaidah lembaga: edisi berstatus Buka wajib sudah punya HTM —
// selama HTM belum ditetapkan, pendaftaran berstatus Tutup (Holiday Camp).
export async function POST(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const jenis = String(body.jenis || "");
    const nama = String(body.nama || "").trim();
    const branchId = body.branch_id ? String(body.branch_id) : null;
    if (!JENIS_SAH.has(jenis)) {
      return NextResponse.json({ ok: false, error: "Jenis event tidak dikenal." }, { status: 400 });
    }
    if (nama.length < 3 || !branchId) {
      return NextResponse.json({ ok: false, error: "Nama edisi dan cabang wajib diisi." }, { status: 400 });
    }
    const scope = branchScope(denied.user);
    if (scope && !scope.includes(branchId)) {
      return NextResponse.json({ ok: false, error: "Cabang di luar cakupan Anda." }, { status: 403 });
    }
    const htmReguler = body.htm_reguler !== undefined && body.htm_reguler !== "" ? Number(body.htm_reguler) : null;
    const htmEarly = body.htm_early_bird !== undefined && body.htm_early_bird !== "" ? Number(body.htm_early_bird) : null;
    const status = String(body.status || "rancangan");
    if (!["rancangan", "buka", "tutup", "selesai"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Status edisi tidak dikenal." }, { status: 400 });
    }
    if (status === "buka" && htmReguler === null && htmEarly === null) {
      return NextResponse.json(
        { ok: false, error: "HTM belum ditetapkan — edisi tidak dapat dibuka. Tetapkan HTM terlebih dahulu (kaidah Holiday Camp)." },
        { status: 400 }
      );
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO event_edisi
         (branch_id, jenis, nama, tema, tanggal, kuota, htm_reguler, htm_early_bird,
          persen_bagi_hasil, status, proposal_url, rundown, surat_ref, catatan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        branchId,
        jenis,
        nama,
        body.tema ? String(body.tema) : null,
        body.tanggal ? String(body.tanggal).slice(0, 10) : null,
        body.kuota !== undefined && body.kuota !== "" ? Math.max(0, Number(body.kuota) || 0) : null,
        htmReguler,
        htmEarly,
        body.persen_bagi_hasil !== undefined && body.persen_bagi_hasil !== "" ? Number(body.persen_bagi_hasil) : jenis === "pop_up" ? 20 : 0,
        status,
        body.proposal_url ? String(body.proposal_url) : null,
        body.rundown ? String(body.rundown) : null,
        body.surat_ref ? String(body.surat_ref) : null,
        body.catatan ? String(body.catatan) : null,
        denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "event.edisi.create", entityTable: "event_edisi", entityId: rows[0].id, branchId,
      detail: { nama, jenis, status },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat edisi event.") }, { status: 500 });
  }
}
