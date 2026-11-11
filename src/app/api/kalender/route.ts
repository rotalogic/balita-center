import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Kalender tiga lapis: momen & ritme lembaga · pembelajaran ZKC & alur
// kurikulum SAM · acuan kalender pendidikan & tanggal batas Dapodik.
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const dari = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("dari") || "") ? String(url.searchParams.get("dari")) : "2026-01-01";
    const sampai = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("sampai") || "") ? String(url.searchParams.get("sampai")) : "2027-12-31";
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT id, tanggal::text AS tanggal, tanggal_selesai::text AS tanggal_selesai, judul, lapis, keterangan, branch_id FROM kalender_entri
        WHERE tanggal <= $2::date AND COALESCE(tanggal_selesai, tanggal) >= $1::date
          AND ($3::uuid[] IS NULL OR branch_id = ANY($3::uuid[]) OR branch_id IS NULL)
        ORDER BY tanggal, judul`,
      [dari, sampai, scope]
    );
    return NextResponse.json({ ok: true, entri: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const lapis = String(body.lapis || "");
    if (!["momen", "pembelajaran", "dapodik"].includes(lapis)) {
      return NextResponse.json({ ok: false, error: "Lapis kalender tidak dikenal." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || "")) || String(body.judul || "").trim().length < 3) {
      return NextResponse.json({ ok: false, error: "Tanggal dan judul entri wajib diisi." }, { status: 400 });
    }
    const selesai = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal_selesai || "")) && String(body.tanggal_selesai) >= String(body.tanggal)
      ? String(body.tanggal_selesai) : null;
    const rows = await query<{ id: string }>(
      `INSERT INTO kalender_entri (branch_id, tanggal, tanggal_selesai, judul, lapis, keterangan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : null,
        String(body.tanggal), selesai, String(body.judul).trim(), lapis,
        body.keterangan ? String(body.keterangan) : null, denied.user.id,
      ]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah entri kalender.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    await query("DELETE FROM kalender_entri WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
