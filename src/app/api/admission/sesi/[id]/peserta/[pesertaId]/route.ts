import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { JENIS_SESI } from "@/lib/jadwal";

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
    let notifWa = "tidak_perlu";
    if (peserta.status === "terkonfirmasi") {
      const berikut = await query<{ id: string; nama_anak: string; lead_id: string | null }>(
        `SELECT id, nama_anak, lead_id FROM sesi_peserta
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

        // Pemberitahuan otomatis daftar tunggu (Tur Demo Layar 7): keluarga
        // yang naik mendapat pesan lewat antrean wa_outbox, mengikuti ritme
        // dan status kanal WhatsApp yang berlaku. Antrean yang tercatat di
        // sini tidak memaksa kirim bila kanal nonaktif; pesan menunggu di
        // antrean dan tercatat di Jejak Audit lewat detail aksi ini.
        notifWa = "tanpa_nomor";
        try {
          if (berikut[0].lead_id) {
            const [lead, sesi] = await Promise.all([
              query<{ wa_number: string | null; parent_name: string | null }>(
                "SELECT wa_number, parent_name FROM leads WHERE id = $1",
                [berikut[0].lead_id]
              ),
              query<{ jenis: string; tanggal: string; jam_mulai: string | null }>(
                "SELECT jenis, tanggal, jam_mulai FROM sesi_jadwal WHERE id = $1",
                [params.id]
              ),
            ]);
            const nomor = String(lead[0]?.wa_number || "").replace(/\D/g, "");
            if (nomor && sesi[0]) {
              const tanggalSesi = new Date(`${String(sesi[0].tanggal)}T00:00:00`).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const jam = sesi[0].jam_mulai ? ` pukul ${String(sesi[0].jam_mulai).slice(0, 5)}` : "";
              const sapaan = lead[0]?.parent_name ? `Halo ${lead[0].parent_name}, ` : "Halo, ";
              const labelSesi =
                (JENIS_SESI as Record<string, { label: string }>)[sesi[0].jenis]?.label || sesi[0].jenis;
              const teks =
                `${sapaan}kabar baik dari kami: satu kursi pada sesi ${labelSesi} ` +
                `tanggal ${tanggalSesi}${jam} telah kosong, dan ananda ${berikut[0].nama_anak} ` +
                `kini terkonfirmasi dari daftar tunggu. Mohon balas pesan ini untuk memastikan ` +
                `kehadiran. Terima kasih.`;
              await query(
                "INSERT INTO wa_outbox (tujuan, teks_asli, konteks, dibuat_oleh) VALUES ($1, $2, $3::jsonb, $4)",
                [
                  nomor,
                  teks,
                  JSON.stringify({ jenis: "daftar_tunggu_naik", sesi_id: params.id, peserta_id: berikut[0].id }),
                  denied.user.id,
                ]
              );
              notifWa = "terantre";
            }
          }
        } catch {
          notifWa = "gagal_antre";
        }
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
      detail: { anak: peserta.nama_anak, naik_dari_tunggu: naik, notif_wa: notifWa },
    });
    return NextResponse.json({ ok: true, naik_dari_tunggu: naik, notif_wa: notifWa });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
