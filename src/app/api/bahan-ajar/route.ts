import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { KATEGORI_BAHAN_AJAR } from "@/lib/bahan-ajar";

export const dynamic = "force-dynamic";

// Kamar Bahan Ajar Pelengkap (kerangka Tahap 2): isi resmi dimuat dari
// Paket Sistem Terpadu lembaga; di sini hanya strukturnya.
const KATEGORI_SAH = KATEGORI_BAHAN_AJAR.map((k) => k.kode);

export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query(
      `SELECT id, kategori, subkategori, judul, isi, teks_latin, urutan, aktif
         FROM bahan_ajar ORDER BY kategori, urutan, judul`
    );
    return NextResponse.json({ ok: true, bahan: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

function baca(body: Record<string, unknown>) {
  const kategori = String(body.kategori || "");
  if (!KATEGORI_SAH.includes(kategori)) return { error: "Kategori bahan ajar tidak dikenal." };
  const judul = String(body.judul || "").trim();
  if (judul.length < 2) return { error: "Judul bahan wajib diisi." };
  return {
    nilai: {
      kategori,
      subkategori: body.subkategori ? String(body.subkategori).trim() || null : null,
      judul,
      isi: body.isi ? String(body.isi) : null,
      teks_latin: body.teks_latin ? String(body.teks_latin) : null,
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
      `INSERT INTO bahan_ajar (kategori, subkategori, judul, isi, teks_latin, urutan, aktif)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [v.kategori, v.subkategori, v.judul, v.isi, v.teks_latin, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah bahan ajar.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "ID bahan tidak ada." }, { status: 400 });
    const hasil = baca(body);
    if ("error" in hasil) return NextResponse.json({ ok: false, error: hasil.error }, { status: 400 });
    const v = hasil.nilai!;
    await query(
      `UPDATE bahan_ajar SET kategori=$2, subkategori=$3, judul=$4, isi=$5, teks_latin=$6,
              urutan=$7, aktif=$8, updated_at=now() WHERE id=$1`,
      [id, v.kategori, v.subkategori, v.judul, v.isi, v.teks_latin, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengubah bahan ajar.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    await query("DELETE FROM bahan_ajar WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
