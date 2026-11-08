import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { buatPdfLaporan } from "@/lib/pdf/laporan";

export const dynamic = "force-dynamic";

// Berkas PDF laporan (dihasilkan server). Halaman web tetap bentuk kanonis;
// PDF adalah unduhan dengan susunan yang sama.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });

  const rows = await query<Record<string, string | number | null> & { child_id: string }>(
    `SELECT r.id, r.report_date, r.status, r.mood, r.meals_text, r.meal_level, r.snack_text, r.snack_level,
            r.nap_start, r.nap_end, r.nap_quality, r.toilet_pee_count, r.toilet_poop_count, r.notes,
            r.circle_theme, r.circle_rating, r.circle_notes, r.special_moment, r.home_suggestion,
            to_char(r.published_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS published_at,
            c.id AS child_id, c.full_name AS child_name, cl.name AS class_name, b.name AS branch_name,
            s.full_name AS teacher, s.signature_url AS teacher_ttd
       FROM daily_reports r
       JOIN children c ON c.id = r.child_id
       JOIN branches b ON b.id = r.branch_id
       LEFT JOIN classes cl ON cl.id = r.class_id
       LEFT JOIN staff s ON s.id = r.lead_facilitator_id
      WHERE r.id = $1::uuid AND r.deleted_at IS NULL`,
    [params.id]
  );
  const r = rows[0];
  if (!r) return new Response("Laporan tidak ditemukan.", { status: 404 });
  if (r.status !== "published") return new Response("Laporan belum diterbitkan.", { status: 404 });

  let boleh = hasPermission(user, "reports.view") || user.roles.includes("super_admin");
  if (!boleh) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [r.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh laporan ini.", { status: 403 });

  const aktivitas = await query<{
    title: string; apparatus: string | null; area: string | null; rating: string | null;
    activity_time: string | null; notes: string | null; work_location: string | null; work_mode: string | null;
    photo_url: string | null;
  }>(
    `SELECT title, apparatus, area, rating, activity_time, notes, work_location, work_mode, photo_url
       FROM daily_report_activities WHERE report_id = $1::uuid
      ORDER BY sort_order, activity_time NULLS LAST`,
    [params.id]
  );

  // Foto aktivitas ikut masuk PDF bila bisa dimuat; kegagalan memuat satu foto
  // tidak boleh menggagalkan seluruh dokumen.
  const asal = new URL(request.url).origin;
  const fotoBuffers: Array<Buffer | null> = await Promise.all(
    aktivitas.map(async (a) => {
      if (!a.photo_url) return null;
      try {
        const lokal = !a.photo_url.startsWith("http");
        const url = lokal ? `${asal}${a.photo_url}` : a.photo_url;
        // Foto lokal tersimpan di balik login: teruskan cookie sesi peminta.
        const respon = await fetch(url, lokal ? { headers: { cookie: request.headers.get("cookie") || "" } } : undefined);
        if (!respon.ok) return null;
        return Buffer.from(await respon.arrayBuffer());
      } catch {
        return null;
      }
    })
  );

  const banner = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-laporan.jpg")).catch(() => null);
  const ttd = await (async () => {
    const url = (r as Record<string, unknown>).teacher_ttd as string | null;
    if (!url) return null;
    try {
      const lokal = !url.startsWith("http");
      const respon = await fetch(lokal ? `${asal}${url}` : url, lokal ? { headers: { cookie: request.headers.get("cookie") || "" } } : undefined);
      if (!respon.ok) return null;
      return Buffer.from(await respon.arrayBuffer());
    } catch { return null; }
  })();
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
    circle_rating: r.circle_rating === null ? null : Number(r.circle_rating),
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
    photos: fotoBuffers,
    banner,
    ttd,
  });

  const potongan: Buffer[] = [];
  const selesai = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
  });
  doc.end();
  const pdf = await selesai;

  const nama = String(r.child_name).replace(/[^\w\-]+/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan-${nama}-${String(r.report_date).slice(0, 10)}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
