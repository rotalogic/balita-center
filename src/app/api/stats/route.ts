import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Statistik dashboard dihitung dari database sungguhan. Tidak ada angka contoh:
// database kosong menghasilkan nol, database belum terhubung menghasilkan error.
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const branch = new URL(request.url).searchParams.get("branch_id") || null;
    const rows = await query<{ children: string; staff: string; branches: string; revenue: string; pending_reports: string; invoices_open: string }>(
      `SELECT
         (SELECT COUNT(*) FROM children WHERE deleted_at IS NULL
           AND ($1::uuid IS NULL OR branch_id = $1::uuid)) AS children,
         (SELECT COUNT(*) FROM staff WHERE deleted_at IS NULL
           AND ($1::uuid IS NULL OR branch_id = $1::uuid)) AS staff,
         (SELECT COUNT(*) FROM branches WHERE deleted_at IS NULL) AS branches,
         (SELECT COALESCE(SUM(amount),0) FROM cash_book_entries
            WHERE direction='masuk' AND date_trunc('month', entry_date) = date_trunc('month', CURRENT_DATE)
              AND ($1::uuid IS NULL OR branch_id = $1::uuid)) AS revenue,
         (SELECT COUNT(*) FROM daily_reports WHERE status='menunggu_review' AND deleted_at IS NULL
           AND ($1::uuid IS NULL OR branch_id = $1::uuid)) AS pending_reports,
         (SELECT COUNT(*) FROM invoices WHERE status IN ('belum_bayar','menunggu_konfirmasi')
           AND ($1::uuid IS NULL OR branch_id = $1::uuid)) AS invoices_open`,
      [branch]
    );
    const r = rows[0];
    return NextResponse.json({
      ok: true,
      stats: {
        children: Number(r.children),
        staff: Number(r.staff),
        branches: Number(r.branches),
        revenueMonth: Number(r.revenue),
        pendingReports: Number(r.pending_reports),
        invoicesOpen: Number(r.invoices_open),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
