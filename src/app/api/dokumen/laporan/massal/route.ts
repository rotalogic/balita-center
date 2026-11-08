import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { bangunPdfLaporan, gabungPdf } from "@/lib/pdf/bangun";

export const dynamic = "force-dynamic";

// Unduh massal laporan harian: semua laporan TERBIT satu kelas pada satu
// tanggal digabungkan menjadi satu berkas PDF (urutan nama anak).
// Hanya untuk staf.
export async function GET(request: Request) {
  const denied = await guard("reports.view");
  if (denied.error) return denied.error;
  const url = new URL(request.url);
  const kelas = url.searchParams.get("kelas");
  const tanggal = url.searchParams.get("tanggal");
  if (!kelas || !tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return new Response("Parameter kelas dan tanggal (YYYY-MM-DD) wajib diisi.", { status: 400 });
  }

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
      WHERE r.class_id = $1::uuid AND r.report_date = $2::date AND r.status = 'published' AND r.deleted_at IS NULL
      ORDER BY c.full_name`,
    [kelas, tanggal]
  );
  if (!rows.length) {
    return new Response("Belum ada laporan terbit untuk kelas dan tanggal ini.", { status: 404 });
  }

  const asal = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";
  const buffers: Buffer[] = [];
  for (const r of rows) {
    buffers.push(await bangunPdfLaporan(r, String((r as Record<string, unknown>).id), asal, cookie));
  }
  const pdf = await gabungPdf(buffers);

  const kelasNama = String(rows[0].class_name || "Kelas").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  await catatAudit(denied.user, {
    action: "dokumen.laporan_massal", entityTable: "daily_reports", entityId: null,
    detail: { kelas: kelasNama, tanggal, jumlah: rows.length },
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan-Massal-${kelasNama}-${tanggal}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
