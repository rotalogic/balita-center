import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Kurikulum ZKC 14 bulan (Nov 2026–Des 2027) + kurikulum Kelas Movement.
// Rangka bulannya tetap; tema & isi resmi dimuat dari Paket Sistem Terpadu.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const bulan = await query(
      `SELECT id, bulan, tema, fondasi, materi_inti, menu_sensory, menu_movement, subtema
         FROM kurikulum_bulan ORDER BY bulan`
    );
    const movement = await query(
      `SELECT id, judul, keterangan, urutan, aktif FROM movement_materi ORDER BY urutan, judul`
    );
    return NextResponse.json({ ok: true, bulan, movement });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const bulan = String(body.bulan || "");
    if (!/^\d{4}-\d{2}$/.test(bulan)) {
      return NextResponse.json({ ok: false, error: "Bulan kurikulum tidak sah." }, { status: 400 });
    }
    const teks = (v: unknown) => (v ? String(v).trim() || null : null);
    await query(
      `UPDATE kurikulum_bulan SET tema=$2, fondasi=$3, materi_inti=$4, menu_sensory=$5,
              menu_movement=$6, subtema=$7, updated_at=now() WHERE bulan=$1`,
      [bulan, teks(body.tema), teks(body.fondasi), teks(body.materi_inti), teks(body.menu_sensory), teks(body.menu_movement), teks(body.subtema)]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan kurikulum bulan ini.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const judul = String(body.judul || "").trim();
    if (judul.length < 2) return NextResponse.json({ ok: false, error: "Judul materi Movement wajib diisi." }, { status: 400 });
    const rows = await query<{ id: string }>(
      `INSERT INTO movement_materi (judul, keterangan, urutan) VALUES ($1,$2,$3) RETURNING id`,
      [judul, body.keterangan ? String(body.keterangan) : null, Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah materi Movement.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    const judul = String(body.judul || "").trim();
    if (!id || judul.length < 2) return NextResponse.json({ ok: false, error: "ID dan judul materi wajib ada." }, { status: 400 });
    await query(
      `UPDATE movement_materi SET judul=$2, keterangan=$3, urutan=$4, aktif=$5, updated_at=now() WHERE id=$1`,
      [id, judul, body.keterangan ? String(body.keterangan) : null, Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0, body.aktif !== false]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengubah materi Movement.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    await query("DELETE FROM movement_materi WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
