import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Bank Deteksi & Rujukan (Tahap 2, folder 04 Paket Sistem Terpadu): katalog
// acuan staf — 12 kelompok indikasi & ambang rujuk, bank program individual,
// 100 indikator usia sekolah, dampak, pemetaan kekuatan MIND, bank tugas
// skrining risiko disleksia, dan kesimpulan kurasi folder bakat minat.
// Seluruhnya bahan acuan; bukan alat diagnosis.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query(
      `SELECT id, kategori, judul, isi, urutan, aktif
         FROM bank_deteksi ORDER BY kategori, urutan, judul`
    );
    return NextResponse.json({ ok: true, entri: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

function baca(body: Record<string, unknown>) {
  const kategori = String(body.kategori || "").trim();
  const judul = String(body.judul || "").trim();
  const isi = String(body.isi || "").trim();
  if (kategori.length < 2) return { error: "Kategori wajib diisi." };
  if (judul.length < 2) return { error: "Judul entri wajib diisi." };
  if (isi.length < 4) return { error: "Isi entri wajib diisi." };
  return {
    nilai: {
      kategori,
      judul,
      isi,
      urutan: Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0,
      aktif: body.aktif !== false,
    },
  };
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const hasil = baca((await request.json()) as Record<string, unknown>);
    if ("error" in hasil) return NextResponse.json({ ok: false, error: hasil.error }, { status: 400 });
    const v = hasil.nilai!;
    const rows = await query<{ id: string }>(
      `INSERT INTO bank_deteksi (kategori, judul, isi, urutan, aktif)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [v.kategori, v.judul, v.isi, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah entri.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "ID entri tidak ada." }, { status: 400 });
    const hasil = baca(body);
    if ("error" in hasil) return NextResponse.json({ ok: false, error: hasil.error }, { status: 400 });
    const v = hasil.nilai!;
    await query(
      `UPDATE bank_deteksi SET kategori=$2, judul=$3, isi=$4, urutan=$5, aktif=$6, updated_at=now() WHERE id=$1`,
      [id, v.kategori, v.judul, v.isi, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengubah entri.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    await query("DELETE FROM bank_deteksi WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
