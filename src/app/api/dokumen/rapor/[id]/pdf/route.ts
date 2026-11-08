import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { bangunPdfRapor } from "@/lib/pdf/bangun";

export const dynamic = "force-dynamic";

// Berkas PDF rapor periodik (dihasilkan server). Halaman web tetap bentuk
// kanonis; PDF adalah unduhan dengan susunan yang sama. Penyusunan dokumen
// ada di lib/pdf/bangun.ts dan dipakai juga oleh unduhan massal.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });

  const rows = await query<Record<string, string | null> & { child_id: string; cycle_start: string; cycle_end: string }>(
    `SELECT cr.*, c.full_name AS child_name, b.name AS branch_name,
            lc.theme AS cycle_theme, lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
            s.full_name AS teacher_name, s.signature_url AS teacher_ttd,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN branches b ON b.id = cr.branch_id
       JOIN learning_cycles lc ON lc.id = cr.cycle_id
       LEFT JOIN staff s ON s.id = cr.created_by
      WHERE cr.id = $1::uuid`,
    [params.id]
  );
  const r = rows[0];
  if (!r) return new Response("Rapor tidak ditemukan.", { status: 404 });
  // Pratinjau draf: khusus staf (reports.view), dokumen diberi penanda DRAF.
  const pratinjau = new URL(request.url).searchParams.get("pratinjau") === "1";
  if (r.status !== "published") {
    if (!(pratinjau && (hasPermission(user, "reports.view") || user.roles.includes("super_admin")))) {
      return new Response("Rapor belum diterbitkan.", { status: 404 });
    }
  }

  let boleh = hasPermission(user, "reports.view") || user.roles.includes("super_admin");
  if (!boleh) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [r.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh rapor ini.", { status: 403 });

  const pdf = await bangunPdfRapor(r, params.id, new URL(request.url).origin, request.headers.get("cookie") || "", pratinjau && r.status !== "published");

  const nama = String(r.child_name).replace(/[^\w\-]+/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pratinjau && r.status !== "published" ? "Pratinjau-Draf-" : ""}Rapor-${nama}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
