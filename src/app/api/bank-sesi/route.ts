import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Bank Sesi Pendampingan Individual (kerangka Tahap 2): kumpulan rencana
// sesi pendampingan; isi resmi dari Paket Sistem Terpadu lembaga.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query(
      `SELECT id, judul, fokus, kelompok_usia, durasi_menit, langkah, urutan, aktif
         FROM bank_sesi_pendampingan ORDER BY urutan, judul`
    );
    return NextResponse.json({ ok: true, sesi: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

function baca(body: Record<string, unknown>) {
  const judul = String(body.judul || "").trim();
  if (judul.length < 2) return { error: "Judul sesi wajib diisi." };
  const durasi = body.durasi_menit === "" || body.durasi_menit == null ? null : Number(body.durasi_menit);
  if (durasi !== null && (!Number.isFinite(durasi) || durasi <= 0)) return { error: "Durasi sesi harus angka menit yang positif." };
  return {
    nilai: {
      judul,
      fokus: body.fokus ? String(body.fokus) : null,
      kelompok_usia: body.kelompok_usia ? String(body.kelompok_usia).trim() || null : null,
      durasi_menit: durasi,
      langkah: body.langkah ? String(body.langkah) : null,
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
      `INSERT INTO bank_sesi_pendampingan (judul, fokus, kelompok_usia, durasi_menit, langkah, urutan, aktif)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [v.judul, v.fokus, v.kelompok_usia, v.durasi_menit, v.langkah, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah sesi.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "ID sesi tidak ada." }, { status: 400 });
    const hasil = baca(body);
    if ("error" in hasil) return NextResponse.json({ ok: false, error: hasil.error }, { status: 400 });
    const v = hasil.nilai!;
    await query(
      `UPDATE bank_sesi_pendampingan SET judul=$2, fokus=$3, kelompok_usia=$4, durasi_menit=$5,
              langkah=$6, urutan=$7, aktif=$8, updated_at=now() WHERE id=$1`,
      [id, v.judul, v.fokus, v.kelompok_usia, v.durasi_menit, v.langkah, v.urutan, v.aktif]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengubah sesi.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    await query("DELETE FROM bank_sesi_pendampingan WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
