import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { bangunPdfRapor, gabungPdf } from "@/lib/pdf/bangun";

export const dynamic = "force-dynamic";

// Unduh massal rapor: semua rapor TERBIT pada satu siklus digabungkan
// menjadi satu berkas PDF (urutan nama anak). Hanya untuk staf.
export async function GET(request: Request) {
  const denied = await guard("reports.view");
  if (denied.error) return denied.error;
  const siklus = new URL(request.url).searchParams.get("siklus");
  if (!siklus) return new Response("Parameter siklus wajib diisi.", { status: 400 });

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
      WHERE cr.cycle_id = $1::uuid AND cr.status = 'published'
      ORDER BY c.full_name`,
    [siklus]
  );
  if (!rows.length) {
    return new Response("Belum ada rapor terbit pada siklus ini.", { status: 404 });
  }

  const asal = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";
  const buffers: Buffer[] = [];
  for (const r of rows) {
    buffers.push(await bangunPdfRapor(r, String((r as Record<string, unknown>).id), asal, cookie));
  }
  const pdf = await gabungPdf(buffers);

  await catatAudit(denied.user, {
    action: "dokumen.rapor_massal", entityTable: "cycle_reports", entityId: null,
    detail: { siklus, jumlah: rows.length, tema: rows[0].cycle_theme },
  });

  const tema = String(rows[0].cycle_theme || "Siklus").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rapor-Massal-${tema}-${rows.length}-anak.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
