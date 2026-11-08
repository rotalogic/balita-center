import { query } from "./db";
import { emailLaporanTerbit, emailRaporTerbit, smtpConfigured } from "./mail";

// Pemberitahuan penerbitan ke orang tua lewat EMAIL.
//
// Kanal WhatsApp (lib/ailsa/notify.ts) nonaktif atas keputusan pemilik,
// jadi email adalah kanal pemberitahuan terbit yang hidup: laporan harian
// dan rapor yang diterbitkan guru memberi tahu wali yang punya alamat
// email tercatat. Saklar adminnya sama dengan kanal WA: bot_settings
// .notify_published. Kegagalan email tidak pernah menggagalkan penerbitan
// (pemanggil memakai void + catch), dan tanpa SMTP fungsi ini diam.

const baseUrl = () => (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function diizinkan(): Promise<boolean> {
  const s = await query<{ notify_published: boolean }>("SELECT notify_published FROM bot_settings WHERE id = 1").catch(() => []);
  return !(s[0] && s[0].notify_published === false);
}

async function waliBeremail(childId: string) {
  return query<{ full_name: string; email: string }>(
    `SELECT DISTINCT g.full_name, g.email
       FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
      WHERE cg.child_id = $1 AND g.email IS NOT NULL AND g.email <> ''`,
    [childId]
  ).catch(() => []);
}

function tanggalPanjang(v: unknown): string {
  const tgl = new Date(`${String(v).slice(0, 10)}T00:00:00+07:00`);
  return tgl.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  });
}

export async function emailLaporanTerbitWali(reportId: string) {
  if (!smtpConfigured()) return { terkirim: 0, alasan: "smtp_belum_diisi" };
  if (!(await diizinkan())) return { terkirim: 0, alasan: "dimatikan_admin" };
  const info = await query<{ child_name: string; child_id: string; status: string; report_date: string }>(
    `SELECT c.full_name AS child_name, c.id AS child_id, r.status, r.report_date::text AS report_date
       FROM daily_reports r JOIN children c ON c.id = r.child_id WHERE r.id = $1`,
    [reportId]
  );
  if (!info[0] || info[0].status !== "published") return { terkirim: 0, alasan: "bukan_terbit" };
  let terkirim = 0;
  for (const w of await waliBeremail(info[0].child_id)) {
    const hasil = await emailLaporanTerbit(w.email, {
      wali: w.full_name,
      anak: info[0].child_name,
      tanggal: tanggalPanjang(info[0].report_date),
      tautan: `${baseUrl()}/connect`,
    });
    if (hasil.ok) terkirim += 1;
  }
  return { terkirim };
}

export async function emailRaporTerbitWali(raporId: string) {
  if (!smtpConfigured()) return { terkirim: 0, alasan: "smtp_belum_diisi" };
  if (!(await diizinkan())) return { terkirim: 0, alasan: "dimatikan_admin" };
  const info = await query<{ child_name: string; child_id: string; status: string; theme: string }>(
    `SELECT c.full_name AS child_name, c.id AS child_id, cr.status, lc.theme
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN learning_cycles lc ON lc.id = cr.cycle_id
      WHERE cr.id = $1`,
    [raporId]
  );
  if (!info[0] || info[0].status !== "published") return { terkirim: 0, alasan: "bukan_terbit" };
  let terkirim = 0;
  for (const w of await waliBeremail(info[0].child_id)) {
    const hasil = await emailRaporTerbit(w.email, {
      wali: w.full_name,
      anak: info[0].child_name,
      siklus: info[0].theme,
      tautan: `${baseUrl()}/connect/rapor`,
    });
    if (hasil.ok) terkirim += 1;
  }
  return { terkirim };
}
