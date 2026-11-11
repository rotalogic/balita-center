import { query } from "@/lib/db";
import type { AgregatRapor } from "./rapor-data";

// Struktur rapor periodik sesuai referensi portal lama. Konstanta, label, dan
// tipe bersama ada di rapor-data.ts (aman untuk klien); modul ini khusus
// server karena agregasinya membaca database.
export * from "./rapor-data";

// Hari sekolah = hari Senin–Jumat di rentang siklus (tanpa kalender libur —
// UI menerangkannya apa adanya lewat baris "Tanpa catatan").
function hitungHariSekolah(mulai: string, akhir: string): number {
  const d = new Date(`${mulai.slice(0, 10)}T00:00:00+07:00`);
  const last = new Date(`${akhir.slice(0, 10)}T00:00:00+07:00`);
  let n = 0;
  while (d <= last) {
    const hari = d.getDay();
    if (hari >= 1 && hari <= 5) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export async function agregatRapor(childId: string, mulai: string, akhir: string, reportId?: string): Promise<AgregatRapor> {
  const [presensi, laporan, ukur, fotoLaporan, fotoAktivitas, fotoSendiri, seriUkur] = await Promise.all([
    query<{ status: string; n: string }>(
      `SELECT status, count(*)::text AS n FROM child_attendance
        WHERE child_id = $1 AND att_date BETWEEN $2::date AND $3::date
        GROUP BY status`,
      [childId, mulai, akhir]
    ),
    query<{ n: string }>(
      `SELECT count(*)::text AS n FROM daily_reports
        WHERE child_id = $1 AND status = 'published' AND deleted_at IS NULL
          AND report_date BETWEEN $2::date AND $3::date`,
      [childId, mulai, akhir]
    ),
    query<{ weight_kg: string | null; height_cm: string | null; head_circumference_cm: string | null; nutrition_status: string | null; checked_on: string }>(
      `SELECT weight_kg, height_cm, head_circumference_cm, nutrition_status, checked_on::text AS checked_on
         FROM health_checks WHERE child_id = $1 AND checked_on <= $2::date
        ORDER BY checked_on DESC LIMIT 1`,
      [childId, akhir]
    ),
    query<{ url: string; caption: string | null; media_type: string | null; poster_url: string | null }>(
      `SELECT p.photo_url AS url, p.caption, p.media_type, p.poster_url FROM daily_report_photos p
         JOIN daily_reports r ON r.id = p.report_id
        WHERE r.child_id = $1 AND r.status = 'published' AND r.deleted_at IS NULL
          AND r.report_date BETWEEN $2::date AND $3::date
        ORDER BY r.report_date, p.created_at LIMIT 6`,
      [childId, mulai, akhir]
    ),
    query<{ url: string; caption: string | null }>(
      `SELECT a.photo_url AS url, a.title AS caption FROM daily_report_activities a
         JOIN daily_reports r ON r.id = a.report_id
        WHERE r.child_id = $1 AND r.status = 'published' AND r.deleted_at IS NULL
          AND a.photo_url IS NOT NULL AND a.photo_url <> ''
          AND r.report_date BETWEEN $2::date AND $3::date
        ORDER BY r.report_date, a.sort_order LIMIT 6`,
      [childId, mulai, akhir]
    ),
    reportId
      ? query<{ url: string; caption: string | null }>(
          `SELECT photo_url AS url, caption FROM cycle_report_photos
            WHERE report_id = $1 ORDER BY sort_order, created_at LIMIT 6`,
          [reportId]
        )
      : Promise.resolve([] as Array<{ url: string; caption: string | null }>),
    query<{ checked_on: string; weight_kg: string | null; height_cm: string | null }>(
      `SELECT checked_on::text AS checked_on, weight_kg, height_cm
         FROM health_checks
        WHERE child_id = $1 AND checked_on <= $2::date
          AND (weight_kg IS NOT NULL OR height_cm IS NOT NULL)
        ORDER BY checked_on ASC LIMIT 24`,
      [childId, akhir]
    ),
  ]);

  const hitung = (status: string) => Number(presensi.find((p) => p.status === status)?.n || 0);
  const hadir = hitung("hadir");
  const izin = hitung("izin");
  const sakit = hitung("sakit");
  const alpa = hitung("alpa");
  const hariSekolah = hitungHariSekolah(mulai, akhir);
  const tercatat = hadir + izin + sakit + alpa;

  // Foto unggahan langsung di rapor tampil lebih dulu, lalu tarikan otomatis
  // dari laporan harian terbit pada siklus yang sama.
  const foto: AgregatRapor["foto"] = [];
  for (const f of fotoSendiri) {
    if (f.url && !foto.some((x) => x.url === f.url)) foto.push({ url: f.url, caption: f.caption, media_type: "image" });
    if (foto.length >= 6) break;
  }
  for (const f of [...fotoLaporan, ...fotoAktivitas]) {
    if (foto.length >= 6) break;
    if (f.url && !foto.some((x) => x.url === f.url)) {
      foto.push({
        url: f.url,
        caption: f.caption,
        media_type: "media_type" in f && f.media_type === "video" ? "video" : "image",
        poster_url: (f as { poster_url?: string | null }).poster_url ?? null,
      });
    }
  }

  const u = ukur[0];
  return {
    hadir,
    izin,
    sakit,
    tanpa_keterangan: alpa,
    hari_sekolah: hariSekolah,
    tanpa_catatan: Math.max(0, hariSekolah - tercatat),
    catatan_harian: Number(laporan[0]?.n || 0),
    berat_kg: u?.weight_kg ?? null,
    tinggi_cm: u?.height_cm ?? null,
    lingkar_kepala_cm: u?.head_circumference_cm ?? null,
    status_gizi: u?.nutrition_status ?? null,
    tanggal_ukur: u?.checked_on ?? null,
    pengukuran: seriUkur.map((s) => ({
      tanggal: s.checked_on,
      berat_kg: s.weight_kg !== null ? Number(s.weight_kg) : null,
      tinggi_cm: s.height_cm !== null ? Number(s.height_cm) : null,
    })),
    foto,
  };
}
