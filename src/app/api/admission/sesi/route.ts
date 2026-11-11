import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { JENIS_SESI, validasiJadwal, type JenisSesi } from "@/lib/jadwal";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const dari = url.searchParams.get("dari") || new Date().toISOString().slice(0, 10);
    const sampai = url.searchParams.get("sampai") || "2099-12-31";
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT s.*,
              COUNT(*) FILTER (WHERE p.status = 'terkonfirmasi')::int AS terisi,
              COUNT(*) FILTER (WHERE p.status = 'daftar_tunggu')::int AS menunggu
         FROM sesi_jadwal s
         LEFT JOIN sesi_peserta p ON p.sesi_id = s.id
        WHERE s.tanggal >= $1 AND s.tanggal <= $2
          AND ($3::uuid[] IS NULL OR s.branch_id = ANY($3::uuid[]))
        GROUP BY s.id
        ORDER BY s.tanggal, s.jam_mulai`,
      [dari, sampai, scope]
    );
    const sesi = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        sisa_kuota: Math.max(0, Number(row.kuota) - Number(row.terisi)),
        label: JENIS_SESI[row.jenis as JenisSesi]?.label || String(row.jenis),
      };
    });
    return NextResponse.json({ ok: true, sesi });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const jenis = String(body.jenis || "") as JenisSesi;
    const info = JENIS_SESI[jenis];
    if (!info) {
      return NextResponse.json({ ok: false, error: "Jenis sesi tidak dikenal." }, { status: 400 });
    }
    const tanggal = String(body.tanggal || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal sesi wajib diisi." }, { status: 400 });
    }
    const jamMulai = String(body.jam_mulai || "").slice(0, 5);
    const valid = validasiJadwal(jenis, jamMulai);
    if (!valid.ok) {
      return NextResponse.json({ ok: false, error: valid.error }, { status: 422 });
    }
    const kuota = Math.max(1, Math.min(60, Number(body.kuota) || info.kuotaBawaan));
    const rows = await query<{ id: string }>(
      `INSERT INTO sesi_jadwal (branch_id, jenis, tanggal, jam_mulai, jam_selesai, kuota, catatan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : null,
        jenis,
        tanggal,
        jamMulai,
        valid.jamSelesai,
        kuota,
        body.catatan ? String(body.catatan) : null,
        denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "admission.sesi.create",
      entityTable: "sesi_jadwal",
      entityId: rows[0].id,
      branchId: body.branch_id ? String(body.branch_id) : null,
      detail: { jenis, tanggal, jam_mulai: jamMulai, jam_selesai: valid.jamSelesai, kuota },
    });
    return NextResponse.json({ ok: true, id: rows[0].id, jam_selesai: valid.jamSelesai });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal membuat sesi.") },
      { status: 500 }
    );
  }
}
