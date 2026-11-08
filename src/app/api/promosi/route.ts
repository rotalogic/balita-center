import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Promosi / kenaikan kelas massal: anak terpilih dipindahkan dari kelas
// asal ke kelas tujuan dalam cabang yang sama. Pendaftaran lama ditutup
// berstatus 'selesai' (riwayat tetap tersimpan), pendaftaran baru dibuat
// berstatus 'aktif' mengikuti program kelas tujuan.

export async function GET(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  const kelas = new URL(request.url).searchParams.get("kelas");
  if (!kelas) return NextResponse.json({ ok: false, error: "Parameter kelas wajib diisi." }, { status: 400 });
  const siswa = await query<{ id: string; full_name: string; sejak: string }>(
    `SELECT c.id, c.full_name, e.start_date::text AS sejak
       FROM enrollments e JOIN children c ON c.id = e.child_id
      WHERE e.class_id = $1::uuid AND e.status = 'aktif' AND c.deleted_at IS NULL
      ORDER BY c.full_name`,
    [kelas]
  );
  return NextResponse.json({ ok: true, siswa });
}

type Body = {
  dari_kelas_id?: string;
  ke_kelas_id?: string;
  anak_ids?: string[];
  tanggal_mulai?: string;
};

export async function POST(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const dari = body.dari_kelas_id || "";
    const ke = body.ke_kelas_id || "";
    const anakIds = Array.from(new Set(body.anak_ids || []));
    const tanggal = body.tanggal_mulai || new Date().toISOString().slice(0, 10);
    if (!dari || !ke) return NextResponse.json({ ok: false, error: "Kelas asal dan kelas tujuan wajib dipilih." }, { status: 400 });
    if (dari === ke) return NextResponse.json({ ok: false, error: "Kelas tujuan harus berbeda dari kelas asal." }, { status: 400 });
    if (!anakIds.length) return NextResponse.json({ ok: false, error: "Pilih minimal satu anak untuk dipromosikan." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ ok: false, error: "Tanggal mulai tidak benar." }, { status: 400 });

    const kelas = await query<{ id: string; branch_id: string; program_id: string | null; name: string }>(
      "SELECT id, branch_id, program_id, name FROM classes WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL",
      [[dari, ke]]
    );
    const kDari = kelas.find((k) => k.id === dari);
    const kKe = kelas.find((k) => k.id === ke);
    if (!kDari || !kKe) return NextResponse.json({ ok: false, error: "Kelas asal atau tujuan tidak ditemukan." }, { status: 404 });
    if (kDari.branch_id !== kKe.branch_id) {
      return NextResponse.json({ ok: false, error: "Promosi massal hanya untuk kelas dalam cabang yang sama." }, { status: 400 });
    }

    // Validasi dulu: semua anak harus benar-benar aktif di kelas asal.
    const aktif = await query<{ child_id: string }>(
      `SELECT child_id FROM enrollments
        WHERE class_id = $1::uuid AND status = 'aktif' AND child_id = ANY($2::uuid[])`,
      [dari, anakIds]
    );
    if (aktif.length !== anakIds.length) {
      return NextResponse.json(
        { ok: false, error: `Hanya ${aktif.length} dari ${anakIds.length} anak yang aktif di kelas asal. Muat ulang daftar lalu coba lagi.` },
        { status: 409 }
      );
    }

    let dipindah = 0;
    for (const anakId of anakIds) {
      await query(
        `UPDATE enrollments
            SET status = 'selesai', end_date = ($2::date - INTERVAL '1 day')::date, updated_at = now()
          WHERE child_id = $1::uuid AND class_id = $3::uuid AND status = 'aktif'`,
        [anakId, tanggal, dari]
      );
      await query(
        `INSERT INTO enrollments (branch_id, child_id, class_id, program_id, start_date, status)
         VALUES ($1, $2, $3, $4, $5::date, 'aktif')`,
        [kKe.branch_id, anakId, ke, kKe.program_id, tanggal]
      );
      dipindah += 1;
    }

    await catatAudit(denied.user, {
      action: "akademik.promosi_massal",
      entityTable: "enrollments",
      entityId: null,
      detail: { dari_kelas: kDari.name, ke_kelas: kKe.name, jumlah: dipindah, tanggal_mulai: tanggal },
    });
    return NextResponse.json({ ok: true, dipindah, pesan: `${dipindah} anak dipromosikan ke ${kKe.name}.` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
