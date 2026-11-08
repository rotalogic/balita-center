import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { buatCsv, buatXlsx } from "@/lib/xlsx";
import { tanggalPanjang, jamRapi } from "@/lib/format";

export const dynamic = "force-dynamic";

type Filter = { dari: string; sampai: string; branch: string; kelas: string; status: string };

function bacaFilter(url: URL, scope: string[] | null): Filter & { args: unknown[] } {
  const hariIni = new Date().toISOString().slice(0, 10);
  const dari = url.searchParams.get("dari") || `${hariIni.slice(0, 7)}-01`;
  const sampai = url.searchParams.get("sampai") || hariIni;
  const branch = url.searchParams.get("branch_id") || "";
  const kelas = url.searchParams.get("class_id") || "";
  const status = url.searchParams.get("status") || "";
  return {
    dari,
    sampai,
    branch,
    kelas,
    status,
    args: [dari, sampai, scope, branch || null, kelas || null, status || null],
  };
}

const WHERE = `r.deleted_at IS NULL
   AND r.report_date BETWEEN $1::date AND $2::date
   AND ($3::uuid[] IS NULL OR r.branch_id = ANY($3::uuid[]))
   AND ($4::uuid IS NULL OR r.branch_id = $4)
   AND ($5::uuid IS NULL OR r.class_id = $5)
   AND ($6::text IS NULL OR r.status = $6)`;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  menunggu_review: "Menunggu Review",
  published: "Terbit",
  revisi: "Revisi",
};

export async function GET(request: Request) {
  const denied = await guard("reports.view");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const filter = bacaFilter(url, branchScope(denied.user));
    const format = (url.searchParams.get("format") || "").toLowerCase();

    const rows = await query<Record<string, unknown>>(
      `SELECT r.id, r.report_date, r.status, c.full_name AS child_name,
              k.name AS class_name, b.name AS branch_name,
              s.full_name AS teacher_name, r.mood,
              (SELECT count(*)::int FROM daily_report_photos p WHERE p.report_id = r.id) AS photo_count,
              (SELECT count(*)::int FROM daily_report_activities a WHERE a.report_id = r.id) AS activity_count
         FROM daily_reports r
         JOIN children c ON c.id = r.child_id
         LEFT JOIN classes k ON k.id = r.class_id
         LEFT JOIN branches b ON b.id = r.branch_id
         LEFT JOIN staff s ON s.id = r.created_by
        WHERE ${WHERE}
        ORDER BY r.report_date DESC, c.full_name LIMIT 5000`,
      filter.args
    );

    if (format === "csv" || format === "xlsx") {
      const header = ["Tanggal", "Anak", "Kelas", "Cabang", "Guru", "Status", "Jumlah Foto", "Jumlah Aktivitas"];
      const isi = rows.map((r) => [
        tanggalPanjang(String(r.report_date)),
        String(r.child_name ?? ""),
        String(r.class_name ?? ""),
        String(r.branch_name ?? ""),
        String(r.teacher_name ?? ""),
        STATUS_LABEL[String(r.status)] || String(r.status),
        Number(r.photo_count || 0),
        Number(r.activity_count || 0),
      ]);

      const cabangLabel = filter.branch
        ? String((await query<{ name: string }>("SELECT name FROM branches WHERE id=$1", [filter.branch]))[0]?.name || "cabang")
        : "semua-cabang";
      const nama = `laporan-harian_${filter.dari}_${filter.sampai}_${cabangLabel}`
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "-");

      if (format === "csv") {
        return new NextResponse(buatCsv(header, isi), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${nama}.csv"`,
          },
        });
      }
      return new NextResponse(buatXlsx(header, isi, "Laporan Harian"), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nama}.xlsx"`,
        },
      });
    }

    const ringkas = await query<Record<string, unknown>>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE r.status = 'published')::int AS terbit,
              count(*) FILTER (WHERE r.status = 'menunggu_review')::int AS menunggu,
              count(*) FILTER (WHERE r.status = 'draft')::int AS draft,
              count(DISTINCT r.child_id)::int AS anak
         FROM daily_reports r WHERE ${WHERE}`,
      filter.args
    );

    const kehadiran = await query<{ hadir: number; total: number }>(
      `SELECT count(*) FILTER (WHERE a.status = 'hadir')::int AS hadir, count(*)::int AS total
         FROM child_attendance a
         JOIN children c ON c.id = a.child_id
        WHERE a.att_date BETWEEN $1::date AND $2::date
          AND ($3::uuid[] IS NULL OR c.branch_id = ANY($3::uuid[]))
          AND ($4::uuid IS NULL OR a.branch_id = $4)
          AND ($5::uuid IS NULL OR a.class_id = $5)`,
      [filter.dari, filter.sampai, filter.args[2], filter.branch || null, filter.kelas || null]
    );

    return NextResponse.json({
      ok: true,
      filter: { dari: filter.dari, sampai: filter.sampai, branch_id: filter.branch, class_id: filter.kelas, status: filter.status },
      ringkas: ringkas[0],
      kehadiran: kehadiran[0],
      reports: rows.map((r) => ({
        ...r,
        tanggal: tanggalPanjang(String(r.report_date)),
        status_label: STATUS_LABEL[String(r.status)] || String(r.status),
        jam: jamRapi(String(r.created_at || "")),
      })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
