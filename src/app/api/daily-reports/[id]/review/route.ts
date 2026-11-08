import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Alur review laporan harian: menunggu_review -> disetujui -> published,
// atau dikembalikan menjadi revisi. Penerbitan tetap dijaga trigger database:
// laporan yang syaratnya belum lengkap ditolak PostgreSQL dan pesannya
// diteruskan ke pengguna apa adanya.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.review");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { action: string; reviewer_id: string; notes?: string };
    const actionMap: Record<string, { status: string; reviewAction: string }> = {
      setujui: { status: "disetujui", reviewAction: "setujui" },
      revisi: { status: "revisi", reviewAction: "kembalikan_revisi" },
      terbitkan: { status: "published", reviewAction: "terbitkan" },
    };
    const mapped = actionMap[body.action];
    if (!mapped) {
      return NextResponse.json({ ok: false, error: "Aksi review tidak dikenal." }, { status: 400 });
    }
    if (!body.reviewer_id) {
      return NextResponse.json({ ok: false, error: "Reviewer (staf) wajib dipilih." }, { status: 400 });
    }
    const reportRows = await query<{ branch_id: string }>("SELECT branch_id FROM daily_reports WHERE id = $1", [params.id]);
    if (reportRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    await query("UPDATE daily_reports SET status = $1, reviewer_notes = COALESCE($2, reviewer_notes) WHERE id = $3", [
      mapped.status,
      body.notes || null,
      params.id,
    ]);
    await query(
      "INSERT INTO daily_report_reviews (branch_id, report_id, reviewer_id, action, notes) VALUES ($1,$2,$3,$4,$5)",
      [reportRows[0].branch_id, params.id, body.reviewer_id, mapped.reviewAction, body.notes || null]
    );
    return NextResponse.json({ ok: true, status: mapped.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 422 });
  }
}
