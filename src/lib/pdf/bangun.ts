import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { query } from "../db";
import { buatPdfLaporan } from "./laporan";
import { buatPdfRapor } from "./rapor";
import { getIdentitas, kopLengkap, kopTigaBaris } from "../sekolah";
import { KOLOM_NARASI, agregatRapor } from "../rapor";

// Pembangun berkas PDF laporan & rapor yang dipakai route unduhan tunggal
// maupun unduhan massal. Baris data (r) berasal dari query route pemanggil
// (yang juga menegakkan izin); fungsi di sini hanya menyusun dokumen.

async function muatBerkas(url: string | null, asal: string, cookie: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const lokal = !url.startsWith("http");
    const respon = await fetch(lokal ? `${asal}${url}` : url, lokal ? { headers: { cookie } } : undefined);
    if (!respon.ok) return null;
    return Buffer.from(await respon.arrayBuffer());
  } catch {
    return null;
  }
}

function kumpulkan(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const potongan: Buffer[] = [];
  const selesai = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
  });
  doc.end();
  return selesai;
}

type BarisLaporan = Record<string, string | number | null> & { child_id: string };

export async function bangunPdfLaporan(r: BarisLaporan, reportId: string, asal: string, cookie: string): Promise<Buffer> {
  const aktivitas = await query<{
    title: string; apparatus: string | null; area: string | null; rating: string | null;
    activity_time: string | null; notes: string | null; work_location: string | null; work_mode: string | null;
    photo_url: string | null;
  }>(
    `SELECT title, apparatus, area, rating, activity_time, notes, work_location, work_mode, photo_url
       FROM daily_report_activities WHERE report_id = $1::uuid
      ORDER BY sort_order, activity_time NULLS LAST`,
    [reportId]
  );
  const segmen = await query<{ segmen: string; catatan: string }>(
    "SELECT segmen, catatan FROM daily_report_segments WHERE report_id = $1::uuid",
    [reportId]
  );
  const fotoBuffers = await Promise.all(aktivitas.map((a) => muatBerkas(a.photo_url, asal, cookie)));
  const banner = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-laporan.jpg")).catch(() => null);
  const identitas = await getIdentitas();
  const logo = await muatBerkas(identitas.logo_url, asal, cookie);
  const ttd = await muatBerkas((r.teacher_ttd as string | null) || null, asal, cookie);

  const doc = buatPdfLaporan({
    child_name: String(r.child_name),
    class_name: r.class_name ? String(r.class_name) : null,
    branch_name: String(r.branch_name),
    report_date: String(r.report_date),
    teacher: r.teacher ? String(r.teacher) : null,
    mood: r.mood ? String(r.mood) : null,
    meals_text: r.meals_text ? String(r.meals_text) : null,
    meal_level: r.meal_level ? String(r.meal_level) : null,
    snack_text: r.snack_text ? String(r.snack_text) : null,
    snack_level: r.snack_level ? String(r.snack_level) : null,
    nap_start: r.nap_start ? String(r.nap_start) : null,
    nap_end: r.nap_end ? String(r.nap_end) : null,
    nap_quality: r.nap_quality ? String(r.nap_quality) : null,
    toilet_pee_count: Number(r.toilet_pee_count) || 0,
    toilet_poop_count: Number(r.toilet_poop_count) || 0,
    notes: r.notes ? String(r.notes) : null,
    circle_theme: r.circle_theme ? String(r.circle_theme) : null,
    circle_rating: r.circle_rating === null || r.circle_rating === undefined ? null : Number(r.circle_rating),
    circle_notes: r.circle_notes ? String(r.circle_notes) : null,
    special_moment: r.special_moment ? String(r.special_moment) : null,
    home_suggestion: r.home_suggestion ? String(r.home_suggestion) : null,
    published_at: r.published_at ? String(r.published_at) : null,
    activities: aktivitas.map((a) => ({
      title: a.title,
      apparatus: a.apparatus,
      area: a.area,
      rating: a.rating === null ? null : Number(a.rating),
      activity_time: a.activity_time,
      notes: a.notes,
      work_location: a.work_location,
      work_mode: a.work_mode,
    })),
    segments: segmen,
    photos: fotoBuffers,
    banner,
    ttd,
    logo,
    sekolah_kop: kopLengkap(identitas),
    kop_baris: kopTigaBaris(identitas),
  });
  return kumpulkan(doc);
}

type BarisRapor = Record<string, string | null> & { child_id: string; cycle_start: string; cycle_end: string };

export async function bangunPdfRapor(r: BarisRapor, reportId: string, asal: string, cookie: string, pratinjau = false): Promise<Buffer> {
  const agregat = await agregatRapor(r.child_id, r.cycle_start, r.cycle_end, reportId);
  const fotoBuffers = await Promise.all(
    agregat.foto.map((f) => muatBerkas((f.media_type === "video" ? f.poster_url : f.url) ?? null, asal, cookie))
  );
  const narratives: Record<string, string | null> = {};
  for (const k of KOLOM_NARASI) narratives[k] = r[k] ? String(r[k]) : null;

  const banner = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-rapor.jpg")).catch(() => null);
  const ilustrasi = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-laporan.jpg")).catch(() => null);
  const identitas = await getIdentitas();
  const logo = await muatBerkas(identitas.logo_url, asal, cookie);
  const ttd = await muatBerkas((r.teacher_ttd as string | null) || null, asal, cookie);

  const doc = buatPdfRapor({
    child_name: String(r.child_name),
    class_name: r.class_name ? String(r.class_name) : null,
    branch_name: String(r.branch_name),
    cycle_theme: String(r.cycle_theme),
    cycle_start: r.cycle_start,
    cycle_end: r.cycle_end,
    teacher: r.teacher_name ? String(r.teacher_name) : null,
    status: String(r.status),
    narratives,
    inggris_tahap: r.inggris_tahap ? Number(r.inggris_tahap) : null,
    tanggapan_ortu: r.tanggapan_ortu ? String(r.tanggapan_ortu) : null,
    agregat,
    photos: fotoBuffers,
    sekolah_kop: kopLengkap(identitas),
    kop_baris: kopTigaBaris(identitas),
    banner,
    ilustrasi,
    ttd,
    logo,
    pratinjau,
  });
  return kumpulkan(doc);
}

// Gabungkan beberapa berkas PDF menjadi satu (urutan sesuai masukan).
export async function gabungPdf(buffers: Buffer[]): Promise<Buffer> {
  const hasil = await PDFDocument.create();
  for (const b of buffers) {
    const sumber = await PDFDocument.load(b);
    const halaman = await hasil.copyPages(sumber, sumber.getPageIndices());
    for (const h of halaman) hasil.addPage(h);
  }
  return Buffer.from(await hasil.save());
}
