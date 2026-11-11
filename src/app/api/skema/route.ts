import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Daftar skema biaya + program yang tertaut.
export async function GET() {
  const denied = await guard("finance.view");
  if (denied.error) return denied.error;
  try {
    const [skema, programs] = await Promise.all([
      query("SELECT * FROM skema_biaya ORDER BY created_at DESC"),
      query("SELECT id, name, skema_id FROM programs WHERE deleted_at IS NULL ORDER BY name"),
    ]);
    return NextResponse.json({ ok: true, skema, programs });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Buat skema biaya baru — selalu lahir berstatus Rancangan.
export async function POST(request: Request) {
  const denied = await guard("finance.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nama = String(body.nama || "").trim();
    if (nama.length < 3) {
      return NextResponse.json({ ok: false, error: "Nama skema wajib diisi." }, { status: 400 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO skema_biaya (branch_id, nama, komponen, keterangan, created_by)
       VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : null,
        nama,
        JSON.stringify(Array.isArray(body.komponen) ? body.komponen : []),
        body.keterangan ? String(body.keterangan) : null,
        denied.user.id,
      ]
    );
    return NextResponse.json({ ok: true, id: rows[0].id, status: "rancangan" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat skema.") }, { status: 500 });
  }
}
