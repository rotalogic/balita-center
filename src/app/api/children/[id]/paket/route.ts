import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Riwayat Sesi & Paket anak (Tur Demo Layar 2). Paket sesi dicatat staf di
// sini; sesi terpakai tidak diketik, melainkan dihitung dari kehadiran
// berstatus hadir sejak tanggal paket mulai sampai tanggal selesai paket
// (atau hari ini bila paket belum selesai). Aturan hitung ini ditampilkan
// apa adanya di berkas anak.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const anak = await query<{ id: string; branch_id: string }>(
      "SELECT id, branch_id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }

    const [paket, sesiBulanIni, insidentil, sesiMendatang] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT p.*,
                (SELECT COUNT(*)::int FROM child_attendance a
                  WHERE a.child_id = p.child_id AND a.status = 'hadir'
                    AND a.att_date >= p.mulai_pada
                    AND (p.selesai_pada IS NULL OR a.att_date <= p.selesai_pada)) AS terpakai
           FROM paket_sesi_anak p
          WHERE p.child_id = $1
          ORDER BY (p.status = 'aktif') DESC, p.mulai_pada DESC`,
        [params.id]
      ),
      query<{ status: string; n: string }>(
        `SELECT status, COUNT(*)::text AS n FROM child_attendance
          WHERE child_id = $1
            AND att_date >= date_trunc('month', CURRENT_DATE)
            AND att_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
          GROUP BY status`,
        [params.id]
      ),
      query<Record<string, unknown>>(
        `SELECT kegiatan_label, kegiatan_jenis, tanggal, status FROM insidentil
          WHERE child_id = $1 ORDER BY tanggal DESC LIMIT 6`,
        [params.id]
      ),
      query<Record<string, unknown>>(
        `SELECT sj.jenis, sj.tanggal, sj.jam_mulai, sj.jam_selesai, sp.status
           FROM sesi_peserta sp JOIN sesi_jadwal sj ON sj.id = sp.sesi_id
          WHERE sp.child_id = $1 AND sj.tanggal >= CURRENT_DATE
            AND sp.status NOT IN ('batal')
          ORDER BY sj.tanggal ASC LIMIT 6`,
        [params.id]
      ),
    ]);

    const hitung = (s: string) => Number(sesiBulanIni.find((r) => r.status === s)?.n || 0);
    return NextResponse.json({
      ok: true,
      paket: paket.map((p) => ({
        ...p,
        terpakai: Number(p.terpakai || 0),
        sisa: Math.max(0, Number(p.total_sesi || 0) - Number(p.terpakai || 0)),
      })),
      sesi_bulan_ini: {
        hadir: hitung("hadir"),
        izin: hitung("izin"),
        sakit: hitung("sakit"),
        alpa: hitung("alpa"),
      },
      insidentil_diikuti: insidentil,
      sesi_mendatang: sesiMendatang,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const anak = await query<{ branch_id: string }>(
      "SELECT branch_id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }
    const nama = String(body.nama_paket || "").trim();
    const total = Math.round(Number(body.total_sesi || 0));
    const mulai = String(body.mulai_pada || "").slice(0, 10);
    const selesai = body.selesai_pada ? String(body.selesai_pada).slice(0, 10) : null;
    if (!nama) return NextResponse.json({ ok: false, error: "Nama paket wajib diisi." }, { status: 400 });
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ ok: false, error: "Total sesi harus bilangan lebih dari 0." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai)) {
      return NextResponse.json({ ok: false, error: "Tanggal mulai paket wajib diisi." }, { status: 400 });
    }
    if (selesai && selesai < mulai) {
      return NextResponse.json({ ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO paket_sesi_anak (branch_id, child_id, nama_paket, total_sesi, mulai_pada, selesai_pada, catatan, created_by)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8) RETURNING id`,
      [anak[0].branch_id, params.id, nama, total, mulai, selesai, String(body.catatan || "").trim() || null, denied.user.id]
    );
    await catatAudit(denied.user, {
      action: "children.paket_sesi.create",
      entityTable: "paket_sesi_anak",
      entityId: rows[0].id,
      detail: { anak: params.id, nama_paket: nama, total_sesi: total, mulai_pada: mulai },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// PATCH: tandai paket selesai atau aktifkan kembali.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { paket_id?: string; status?: string };
    if (!body.paket_id || !["aktif", "selesai"].includes(String(body.status))) {
      return NextResponse.json({ ok: false, error: "Paket dan status baru wajib valid." }, { status: 400 });
    }
    const rows = await query<{ id: string }>(
      "UPDATE paket_sesi_anak SET status = $3, updated_at = now() WHERE id = $1 AND child_id = $2 RETURNING id",
      [body.paket_id, params.id, body.status]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Paket tidak ditemukan." }, { status: 404 });
    }
    await catatAudit(denied.user, {
      action: "children.paket_sesi.status",
      entityTable: "paket_sesi_anak",
      entityId: body.paket_id,
      detail: { anak: params.id, status: body.status },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: hapus catatan paket yang salah input (bukan menandai selesai).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  try {
    const paketId = new URL(request.url).searchParams.get("paket_id");
    if (!paketId) return NextResponse.json({ ok: false, error: "Paket wajib dipilih." }, { status: 400 });
    const rows = await query<{ id: string }>(
      "DELETE FROM paket_sesi_anak WHERE id = $1 AND child_id = $2 RETURNING id",
      [paketId, params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Paket tidak ditemukan." }, { status: 404 });
    }
    await catatAudit(denied.user, {
      action: "children.paket_sesi.delete",
      entityTable: "paket_sesi_anak",
      entityId: paketId,
      detail: { anak: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
