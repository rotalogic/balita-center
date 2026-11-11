import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { bangunPdfLaporan } from "@/lib/pdf/bangun";

export const dynamic = "force-dynamic";

// Berkas PDF laporan (dihasilkan server). Halaman web tetap bentuk kanonis;
// PDF adalah unduhan dengan susunan yang sama. Penyusunan dokumen ada di
// lib/pdf/bangun.ts dan dipakai juga oleh unduhan massal.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });

  const rows = await query<Record<string, string | number | null> & { child_id: string }>(
    `SELECT r.id, r.report_date, r.status, r.mood, r.meals_text, r.meal_level, r.snack_text, r.snack_level,
            r.nap_start, r.nap_end, r.nap_quality, r.toilet_pee_count, r.toilet_poop_count, r.notes,
            r.circle_theme, r.circle_rating, r.circle_notes, r.special_moment, r.home_suggestion,
            to_char(r.published_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS published_at,
            c.id AS child_id, c.full_name AS child_name, c.photo_url AS child_photo, c.tautan_folder_dokumentasi AS child_folder, cl.name AS class_name, b.name AS branch_name,
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

  const pdf = await bangunPdfLaporan(r, params.id, new URL(request.url).origin, request.headers.get("cookie") || "");

  const nama = String(r.child_name).replace(/[^\w\-]+/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan-${nama}-${String(r.report_date).slice(0, 10)}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
