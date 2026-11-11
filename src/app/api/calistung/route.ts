import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Program Khusus Calistung (kerangka Tahap 2): tahapan + materi per tahap.
// Nama tahapan dan materi resmi berasal dari Paket Sistem Terpadu lembaga.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const tahap = await query(`SELECT id, nama, keterangan, urutan, aktif FROM calistung_tahap ORDER BY urutan, nama`);
    const materi = await query(`SELECT id, tahap_id, nama, keterangan, urutan, aktif FROM calistung_materi ORDER BY urutan, nama`);
    return NextResponse.json({ ok: true, tahap, materi });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind || "");
    const nama = String(body.nama || "").trim();
    if (nama.length < 2) return NextResponse.json({ ok: false, error: "Nama wajib diisi." }, { status: 400 });
    const urutan = Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0;
    const keterangan = body.keterangan ? String(body.keterangan) : null;
    if (kind === "tahap") {
      const rows = await query<{ id: string }>(
        `INSERT INTO calistung_tahap (nama, keterangan, urutan) VALUES ($1,$2,$3) RETURNING id`,
        [nama, keterangan, urutan]
      );
      return NextResponse.json({ ok: true, id: rows[0].id });
    }
    if (kind === "materi") {
      const tahapId = String(body.tahap_id || "");
      if (!tahapId) return NextResponse.json({ ok: false, error: "Materi wajib memilih tahapnya." }, { status: 400 });
      const rows = await query<{ id: string }>(
        `INSERT INTO calistung_materi (tahap_id, nama, keterangan, urutan) VALUES ($1,$2,$3,$4) RETURNING id`,
        [tahapId, nama, keterangan, urutan]
      );
      return NextResponse.json({ ok: true, id: rows[0].id });
    }
    return NextResponse.json({ ok: false, error: "Jenis data tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menambah data calistung.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind || "");
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "ID tidak ada." }, { status: 400 });
    const nama = String(body.nama || "").trim();
    if (nama.length < 2) return NextResponse.json({ ok: false, error: "Nama wajib diisi." }, { status: 400 });
    const urutan = Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0;
    const keterangan = body.keterangan ? String(body.keterangan) : null;
    const aktif = body.aktif !== false;
    if (kind === "tahap") {
      await query(`UPDATE calistung_tahap SET nama=$2, keterangan=$3, urutan=$4, aktif=$5, updated_at=now() WHERE id=$1`,
        [id, nama, keterangan, urutan, aktif]);
      return NextResponse.json({ ok: true });
    }
    if (kind === "materi") {
      const tahapId = String(body.tahap_id || "");
      if (!tahapId) return NextResponse.json({ ok: false, error: "Materi wajib memilih tahapnya." }, { status: 400 });
      await query(`UPDATE calistung_materi SET tahap_id=$2, nama=$3, keterangan=$4, urutan=$5, aktif=$6, updated_at=now() WHERE id=$1`,
        [id, tahapId, nama, keterangan, urutan, aktif]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Jenis data tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengubah data calistung.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "";
    const id = url.searchParams.get("id") || "";
    if (kind === "tahap") await query("DELETE FROM calistung_tahap WHERE id = $1", [id]);
    else if (kind === "materi") await query("DELETE FROM calistung_materi WHERE id = $1", [id]);
    else return NextResponse.json({ ok: false, error: "Jenis data tidak dikenal." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
