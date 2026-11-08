import { query } from "@/lib/db";

// Syarat terbit — cermin dari trigger check_daily_report_publish() di database.
// Dipakai untuk memberi tahu guru syarat apa yang kurang SEBELUM menekan kirim,
// bukan menunggu error PostgreSQL saat penerbitan.
export type CekSyarat = { ok: boolean; kurang: string[] };

export async function cekSyaratTerbit(reportId: string): Promise<CekSyarat> {
  const rows = await query<{ lead_facilitator_id: string | null }>(
    "SELECT lead_facilitator_id FROM daily_reports WHERE id = $1",
    [reportId]
  );
  const kurang: string[] = [];

  if (!rows[0]?.lead_facilitator_id) {
    kurang.push("Fasilitator utama belum dipilih.");
  }

  const berbintang = await query<{ ada: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM daily_report_activities
        WHERE report_id = $1 AND rating IS NOT NULL AND apparatus IS NOT NULL AND apparatus <> ''
     ) AS ada`,
    [reportId]
  );
  if (!berbintang[0]?.ada) {
    kurang.push("Belum ada aktivitas dengan rating bintang dan aparatus terisi.");
  }

  const foto = await query<{ ada: boolean }>(
    `SELECT (EXISTS (SELECT 1 FROM daily_report_activities WHERE report_id = $1 AND photo_url IS NOT NULL)
          OR EXISTS (SELECT 1 FROM daily_report_photos  WHERE report_id = $1)) AS ada`,
    [reportId]
  );
  if (!foto[0]?.ada) {
    kurang.push("Minimal 1 foto diperlukan.");
  }

  return { ok: kurang.length === 0, kurang };
}
