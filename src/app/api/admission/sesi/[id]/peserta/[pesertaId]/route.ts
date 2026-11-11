import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type PesertaRow = Record<string, unknown> & { id: string; sesi_id: string; status: string; nama_anak: string };

// PATCH: ubah status kehadiran (hadir / tidak_hadir / terkonfirmasi / daftar_tunggu).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; pesertaId: string } }
) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { status?: string };
    const sah = ["hadir", "tidak_hadir", "terkonfirmasi", "daftar_tunggu"];
    if (!body.status || !sah.includes(body.status)) {
      return NextResponse.json({ ok: false, error: `Status harus salah satu: ${sah.join(", ")}.` }, { status: 400 });
    }
    const rows = await query<PesertaRow>(
      "SELECT * FROM sesi_peserta WHERE id = $1 AND sesi_id = $2",
      [params.pesertaId, params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Peserta tidak ditemukan." }, { status: 404 });
    }
    await query("UPDATE sesi_peserta SET status = $2, updated_at = now() WHERE id = $1", [
      params.pesertaId,
      body.status,
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: batalkan peserta; bila yang batal terkonfirmasi, peserta daftar
// tunggu urutan pertama naik menjadi terkonfirmasi.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; pesertaId: string } }
) {
  const denied = await guard("admission.manage");
  if (denied.error) return denied.error;
  try {
    const rows = await query<PesertaRow>(
      "SELECT * FROM sesi_peserta WHERE id = $1 AND sesi_id = $2",
      [params.pesertaId, params.id]
    );
    const peserta = rows[0];
    if (!peserta) {
      return NextResponse.json({ ok: false, error: "Peserta tidak ditemukan." }, { status: 404 });
    }
    await query("UPDATE sesi_peserta SET status = 'batal', urutan_tunggu = NULL, updated_at = now() WHERE id = $1", [
      params.pesertaId,
    ]);

    let naik: string | null = null;
    if (peserta.status === "terkonfirmasi") {
      const berikut = await query<{ id: string; nama_anak: string }>(
        `SELECT id, nama_anak FROM sesi_peserta
          WHERE sesi_id = $1 AND status = 'daftar_tunggu'
          ORDER BY urutan_tunggu NULLS LAST, created_at ASC
          LIMIT 1`,
        [params.id]
      );
      if (berikut.length > 0) {
        await query(
          "UPDATE sesi_peserta SET status = 'terkonfirmasi', urutan_tunggu = NULL, updated_at = now() WHERE id = $1",
          [berikut[0].id]
        );
        naik = berikut[0].nama_anak;
      }
    }
    // Rapatkan kembali urutan daftar tunggu.
    const tunggu = await query<{ id: string }>(
      `SELECT id FROM sesi_peserta WHERE sesi_id = $1 AND status = 'daftar_tunggu'
        ORDER BY urutan_tunggu NULLS LAST, created_at ASC`,
      [params.id]
    );
    for (const [i, t] of tunggu.entries()) {
      await query("UPDATE sesi_peserta SET urutan_tunggu = $2 WHERE id = $1", [t.id, i + 1]);
    }

    await catatAudit(denied.user, {
      action: "admission.sesi.peserta_cancel",
      entityTable: "sesi_peserta",
      entityId: params.pesertaId,
      detail: { anak: peserta.nama_anak, naik_dari_tunggu: naik },
    });
    return NextResponse.json({ ok: true, naik_dari_tunggu: naik });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
