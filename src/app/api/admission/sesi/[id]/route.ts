import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { JENIS_SESI, type JenisSesi } from "@/lib/jadwal";

export const dynamic = "force-dynamic";

type SesiRow = Record<string, unknown> & { id: string; kuota: number; jenis: string; branch_id: string | null };

async function ambilSesi(id: string): Promise<SesiRow | null> {
  const rows = await query<SesiRow>("SELECT * FROM sesi_jadwal WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const sesi = await ambilSesi(params.id);
    if (!sesi) {
      return NextResponse.json({ ok: false, error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    const peserta = await query(
      `SELECT p.*, l.stage AS lead_stage
         FROM sesi_peserta p LEFT JOIN leads l ON l.id = p.lead_id
        WHERE p.sesi_id = $1
        ORDER BY CASE p.status WHEN 'terkonfirmasi' THEN 0 WHEN 'daftar_tunggu' THEN 1 ELSE 2 END,
                 p.urutan_tunggu NULLS LAST, p.created_at`,
      [params.id]
    );
    const terisi = peserta.filter((p) => (p as Record<string, unknown>).status === "terkonfirmasi").length;
    return NextResponse.json({
      ok: true,
      sesi: { ...sesi, label: JENIS_SESI[sesi.jenis as JenisSesi]?.label || sesi.jenis, sisa_kuota: Math.max(0, sesi.kuota - terisi) },
      peserta,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const sesi = await ambilSesi(params.id);
    if (!sesi) {
      return NextResponse.json({ ok: false, error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const sets: string[] = [];
    const values: unknown[] = [params.id];
    if (body.kuota !== undefined) {
      const kuota = Math.max(1, Math.min(60, Number(body.kuota) || 0));
      const terisi = await query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM sesi_peserta WHERE sesi_id = $1 AND status = 'terkonfirmasi'",
        [params.id]
      );
      if (kuota < (terisi[0]?.n || 0)) {
        return NextResponse.json(
          { ok: false, error: `Kuota tidak dapat lebih kecil dari peserta terkonfirmasi (${terisi[0]?.n}).` },
          { status: 400 }
        );
      }
      values.push(kuota);
      sets.push(`kuota = $${values.length}`);
    }
    if (body.catatan !== undefined) {
      values.push(body.catatan ? String(body.catatan) : null);
      sets.push(`catatan = $${values.length}`);
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada perubahan dikirim." }, { status: 400 });
    }
    await query(`UPDATE sesi_jadwal SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const sesi = await ambilSesi(params.id);
    if (!sesi) {
      return NextResponse.json({ ok: false, error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    await query("DELETE FROM sesi_jadwal WHERE id = $1", [params.id]);
    await catatAudit(denied.user, {
      action: "admission.sesi.delete",
      entityTable: "sesi_jadwal",
      entityId: params.id,
      branchId: sesi.branch_id,
      detail: { jenis: sesi.jenis },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// POST: daftarkan peserta (lead atau anak) — kuota penuh berarti daftar tunggu berurutan.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const sesi = await ambilSesi(params.id);
    if (!sesi) {
      return NextResponse.json({ ok: false, error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const leadId = body.lead_id ? String(body.lead_id) : null;
    const childId = body.child_id ? String(body.child_id) : null;
    let nama = body.nama_anak ? String(body.nama_anak) : "";
    if (leadId) {
      const lead = await query<{ child_name: string | null }>("SELECT child_name FROM leads WHERE id = $1", [leadId]);
      if (lead.length === 0) return NextResponse.json({ ok: false, error: "Lead tidak ditemukan." }, { status: 404 });
      nama = nama || lead[0].child_name || "";
    }
    if (childId) {
      const anak = await query<{ full_name: string }>("SELECT full_name FROM children WHERE id = $1", [childId]);
      if (anak.length === 0) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
      nama = nama || anak[0].full_name;
    }
    if (!nama) {
      return NextResponse.json({ ok: false, error: "Nama anak wajib ada (dari lead, anak, atau isian nama)." }, { status: 400 });
    }

    const hitung = await query<{ terisi: number; menunggu: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'terkonfirmasi')::int AS terisi,
              COUNT(*) FILTER (WHERE status = 'daftar_tunggu')::int AS menunggu
         FROM sesi_peserta WHERE sesi_id = $1`,
      [params.id]
    );
    const terisi = hitung[0]?.terisi || 0;
    const penuh = terisi >= sesi.kuota;
    const status = penuh ? "daftar_tunggu" : "terkonfirmasi";
    const urutan = penuh ? (hitung[0]?.menunggu || 0) + 1 : null;

    const rows = await query<{ id: string }>(
      `INSERT INTO sesi_peserta (sesi_id, lead_id, child_id, nama_anak, status, urutan_tunggu)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [params.id, leadId, childId, nama, status, urutan]
    ).catch((e: Error) => {
      if (/sesi_peserta_.*_unik/.test(e.message)) return [] as Array<{ id: string }>;
      throw e;
    });
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Anak ini sudah terdaftar pada sesi yang sama." },
        { status: 409 }
      );
    }
    await catatAudit(denied.user, {
      action: "admission.sesi.peserta_add",
      entityTable: "sesi_peserta",
      entityId: rows[0].id,
      branchId: sesi.branch_id,
      detail: { anak: nama, status, jenis_sesi: sesi.jenis },
    });
    return NextResponse.json({ ok: true, id: rows[0].id, status, urutan_tunggu: urutan });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal mendaftarkan peserta sesi.") },
      { status: 500 }
    );
  }
}
