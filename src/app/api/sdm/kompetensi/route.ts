import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { JUMLAH_GUGUS } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

// Penilaian Standar & Kompetensi Guru per semester: sepuluh gugus, skala
// kata Tingkat 1–4; Tingkat 3 Kompeten adalah standar minimum.
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const staffId = url.searchParams.get("staff_id");
    const rows = staffId
      ? await query(
          `SELECT k.*, s.full_name AS staff_name FROM kompetensi_penilaian k
             JOIN staff s ON s.id = k.staff_id WHERE k.staff_id = $1 ORDER BY k.created_at DESC`,
          [staffId]
        )
      : await query(
          `SELECT k.*, s.full_name AS staff_name FROM kompetensi_penilaian k
             JOIN staff s ON s.id = k.staff_id ORDER BY k.created_at DESC LIMIT 200`
        );
    return NextResponse.json({ ok: true, penilaian: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const gugus = (body.gugus || []) as Array<{ nama: string; tingkat: number }>;
    if (!body.staff_id || !String(body.semester || "").trim()) {
      return NextResponse.json({ ok: false, error: "Staf dan semester penilaian wajib diisi." }, { status: 400 });
    }
    if (!Array.isArray(gugus) || gugus.length !== JUMLAH_GUGUS) {
      return NextResponse.json(
        { ok: false, error: `Penilaian kompetensi memuat tepat ${JUMLAH_GUGUS} gugus Standar Kompetensi Guru.` },
        { status: 400 }
      );
    }
    for (const g of gugus) {
      if (!String(g.nama || "").trim() || ![1, 2, 3, 4].includes(Number(g.tingkat))) {
        return NextResponse.json(
          { ok: false, error: "Setiap gugus wajib bernama dan dinilai Tingkat 1–4." },
          { status: 400 }
        );
      }
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO kompetensi_penilaian (staff_id, semester, gugus, penilai_nama, catatan, created_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6) RETURNING id`,
      [
        String(body.staff_id), String(body.semester),
        JSON.stringify(gugus.map((g) => ({ nama: String(g.nama), tingkat: Number(g.tingkat) }))),
        body.penilai_nama ? String(body.penilai_nama) : null,
        body.catatan ? String(body.catatan) : null,
        denied.user.id,
      ]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan penilaian kompetensi.") }, { status: 500 });
  }
}
