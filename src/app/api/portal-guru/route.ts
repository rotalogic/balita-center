import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { SQL_ANAK_KELAS_SAAT_INI } from "@/lib/roster";

export const dynamic = "force-dynamic";

// Beranda Portal Guru (Tur Demo Layar 23): semua yang tampil di sini dibaca
// dari data staf yang tertaut ke akun yang masuk. Akun tanpa tautan staf
// mendapat penjelasan, bukan data guru lain.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const user = denied.user;
  try {
    const staf = await query<Record<string, unknown>>(
      `SELECT id, full_name, position, branch_id FROM staff
        WHERE deleted_at IS NULL
          AND (user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2)))
        ORDER BY (user_id = $1) DESC
        LIMIT 1`,
      [user.id, user.email]
    );
    if (staf.length === 0) {
      return NextResponse.json({ ok: true, tertaut: false });
    }
    const saya = staf[0];
    const staffId = String(saya.id);
    const hariIni = new Date().toISOString().slice(0, 10);

    const kelas = await query<Record<string, unknown>>(
      `SELECT id, name, kelompok FROM classes
        WHERE lead_staff_id = $1 AND is_active AND deleted_at IS NULL
        ORDER BY name`,
      [staffId]
    );

    const anakHariIni: Array<Record<string, unknown>> = [];
    for (const k of kelas) {
      const anak = await query<{ id: string; full_name: string }>(SQL_ANAK_KELAS_SAAT_INI, [
        String(k.id),
        hariIni,
      ]);
      for (const a of anak) {
        anakHariIni.push({ ...a, kelas_id: k.id, kelas_nama: k.name, kelompok: k.kelompok });
      }
    }
    const idAnak = anakHariIni.map((a) => String(a.id));

    let absensi = new Map<string, string>();
    let laporanAnak = new Map<string, { id: string; status: string }>();
    if (idAnak.length > 0) {
      const abs = await query<{ child_id: string; status: string }>(
        "SELECT child_id, status FROM child_attendance WHERE child_id = ANY($1::uuid[]) AND att_date = CURRENT_DATE",
        [idAnak]
      );
      absensi = new Map(abs.map((r) => [r.child_id, r.status]));
      const lap = await query<{ id: string; child_id: string; status: string }>(
        `SELECT id, child_id, status FROM daily_reports
          WHERE child_id = ANY($1::uuid[]) AND report_date = CURRENT_DATE AND deleted_at IS NULL`,
        [idAnak]
      );
      laporanAnak = new Map(lap.map((r) => [r.child_id, { id: r.id, status: r.status }]));
    }

    const [hitungLaporan, laporanTerbaru, poin, refleksi] = await Promise.all([
      query<{ status: string; n: string }>(
        `SELECT status, COUNT(*)::text AS n FROM daily_reports
          WHERE lead_facilitator_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [staffId]
      ),
      query<Record<string, unknown>>(
        `SELECT r.id, r.report_date, r.status, c.full_name AS child_name
           FROM daily_reports r JOIN children c ON c.id = r.child_id
          WHERE r.lead_facilitator_id = $1 AND r.deleted_at IS NULL
          ORDER BY r.report_date DESC, r.updated_at DESC LIMIT 8`,
        [staffId]
      ),
      query<{ periode: string; rata: string; jumlah: string; penilai: string }>(
        `SELECT periode, AVG(poin)::text AS rata, COUNT(*)::text AS jumlah,
                COUNT(DISTINCT guardian_email)::text AS penilai
           FROM penilaian_guru WHERE staff_id = $1
          GROUP BY periode ORDER BY MAX(created_at) DESC LIMIT 1`,
        [staffId]
      ),
      query<{ n: string }>(
        "SELECT COUNT(*)::text AS n FROM refleksi_guru WHERE penulis_id = $1 AND tanggal = CURRENT_DATE",
        [staffId]
      ),
    ]);

    const hitung = (status: string) =>
      Number(hitungLaporan.find((r) => r.status === status)?.n || 0);
    const hadirTanpaLaporan = anakHariIni.filter(
      (a) => absensi.get(String(a.id)) === "hadir" && !laporanAnak.has(String(a.id))
    ).length;

    return NextResponse.json({
      ok: true,
      tertaut: true,
      saya: { id: staffId, nama: saya.full_name, posisi: saya.position },
      kelas: kelas.map((k) => ({ id: k.id, nama: k.name, kelompok: k.kelompok })),
      anak_hari_ini: anakHariIni.map((a) => ({
        id: a.id,
        nama: a.full_name,
        kelas_nama: a.kelas_nama,
        kelompok: a.kelompok,
        absensi: absensi.get(String(a.id)) || null,
        laporan: laporanAnak.get(String(a.id)) || null,
      })),
      laporan_saya: {
        draf: hitung("draft"),
        menunggu_review: hitung("menunggu_review"),
        terbit: hitung("published"),
        terbaru: laporanTerbaru,
      },
      poin_saya: poin[0]
        ? {
            periode: poin[0].periode,
            rata_rata: Math.round(Number(poin[0].rata) * 10) / 10,
            jumlah_penilaian: Number(poin[0].jumlah),
            jumlah_penilai: Number(poin[0].penilai),
          }
        : null,
      pengingat: {
        laporan_belum_dibuat: hadirTanpaLaporan,
        refleksi_hari_ini: Number(refleksi[0]?.n || 0) > 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
