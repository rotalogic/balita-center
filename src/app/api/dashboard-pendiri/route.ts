import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const LABEL_TAHAP_LEAD: Record<string, string> = {
  inquiry: "1 · Inquiry",
  formulir_triase: "2 · Formulir & Triase",
  penjadwalan: "3 · Penjadwalan",
  trial_discovery: "4 · Trial / Discovery",
  wawancara: "5 · Wawancara Orang Tua",
  sesi_hasil: "6 · Sesi Hasil",
  registrasi_orientasi: "7 · Registrasi & Orientasi",
  baseline: "8 · Baseline Berjalan",
  tidak_lanjut: "Tidak Lanjut",
};

// Satu pandangan pagi pendiri (Tur Demo Layar 1): angka-angkanya dibaca
// langsung dari modul asalnya (Anak, Admission, Laporan, Skrining,
// Keuangan, Masukan, Surat, Kalender). Hanya peran pendiri dan super
// admin yang menerima isinya; peran lain mendapat penanda tampil=false.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const user = denied.user;
  const pendiri = [...user.roles, user.role].some((r) => ["owner", "super_admin"].includes(r));
  if (!pendiri) return NextResponse.json({ ok: true, tampil: false });
  try {
    const [anakTotal, perKategori, anakTrial, antrean, tungguSesi, laporan, rujukan, tunggakan, masukan, surat, kalender] =
      await Promise.all([
        query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM children WHERE deleted_at IS NULL AND status = 'aktif'"
        ),
        query<{ kategori: string; n: string }>(
          `SELECT COALESCE(kategori_program, 'ZKC') AS kategori, COUNT(*)::text AS n
             FROM children WHERE deleted_at IS NULL AND status = 'aktif'
            GROUP BY COALESCE(kategori_program, 'ZKC')`
        ),
        query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM children WHERE deleted_at IS NULL AND status = 'aktif' AND label_status = 'Trial'"
        ),
        query<{ stage: string; n: string }>(
          "SELECT COALESCE(stage, 'inquiry') AS stage, COUNT(*)::text AS n FROM leads GROUP BY COALESCE(stage, 'inquiry')"
        ),
        query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM sesi_peserta WHERE status = 'daftar_tunggu'"
        ),
        query<{ status: string; n: string }>(
          `SELECT status, COUNT(*)::text AS n FROM daily_reports
            WHERE deleted_at IS NULL
              AND report_date >= date_trunc('month', CURRENT_DATE)
              AND report_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            GROUP BY status`
        ),
        query<{ aktif: string; menunggu_terbit: string }>(
          `SELECT COUNT(*) FILTER (WHERE status NOT IN ('selesai','dibatalkan','ditolak'))::text AS aktif,
                  COUNT(*) FILTER (WHERE status = 'draf')::text AS menunggu_terbit
             FROM berkas_rujukan`
        ),
        query<{ n: string; total: string; lewat: string }>(
          `SELECT COUNT(*)::text AS n, COALESCE(SUM(amount),0)::text AS total,
                  COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::text AS lewat
             FROM invoices WHERE status IN ('belum_bayar','menunggu_konfirmasi')`
        ),
        query<Record<string, unknown>>(
          `SELECT child_name, aspek, status, created_at FROM masukan_ortu
            ORDER BY created_at DESC LIMIT 3`
        ),
        query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM surat
            WHERE status = 'terbit' AND diterbitkan_at >= now() - INTERVAL '7 days'`
        ),
        query<Record<string, unknown>>(
          `SELECT judul, tanggal, lapis FROM kalender_entri
            WHERE tanggal >= CURRENT_DATE ORDER BY tanggal ASC LIMIT 3`
        ),
      ]);

    const hitungLaporan = (s: string) => Number(laporan.find((r) => r.status === s)?.n || 0);
    const totalAntrean = antrean
      .filter((r) => r.stage !== "tidak_lanjut")
      .reduce((s, r) => s + Number(r.n), 0);

    return NextResponse.json({
      ok: true,
      tampil: true,
      anak: {
        total: Number(anakTotal[0]?.n || 0),
        per_kategori: perKategori.map((r) => ({ kategori: r.kategori, jumlah: Number(r.n) })),
        trial: Number(anakTrial[0]?.n || 0),
      },
      antrean_trial: {
        total: totalAntrean,
        per_tahap: antrean.map((r) => ({
          tahap: LABEL_TAHAP_LEAD[r.stage] || r.stage,
          jumlah: Number(r.n),
        })),
        daftar_tunggu_sesi: Number(tungguSesi[0]?.n || 0),
      },
      laporan_bulan_ini: {
        terbit: hitungLaporan("published"),
        draf: hitungLaporan("draft"),
        proses: hitungLaporan("menunggu_review") + hitungLaporan("disetujui"),
      },
      rujukan: {
        aktif: Number(rujukan[0]?.aktif || 0),
        menunggu_terbit: Number(rujukan[0]?.menunggu_terbit || 0),
      },
      tunggakan: {
        tagihan: Number(tunggakan[0]?.n || 0),
        total: Number(tunggakan[0]?.total || 0),
        lewat_jatuh_tempo: Number(tunggakan[0]?.lewat || 0),
      },
      masukan_terbaru: masukan,
      surat_terbit_7_hari: Number(surat[0]?.n || 0),
      kalender_terdekat: kalender,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
