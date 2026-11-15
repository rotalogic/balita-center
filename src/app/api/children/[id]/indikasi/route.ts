import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { LABEL_JENIS_SKRINING, type BarisIndikasi } from "@/lib/skrining";

export const dynamic = "force-dynamic";

// Ringkasan indikasi untuk kepala berkas anak: membaca Laporan Hasil
// Skrining terakhir anak ini dan mengelompokkan baris pemetaan Tahap 4
// per kelompok indikasi. Bahasa yang tampil adalah bahasa pemetaan,
// bukan diagnosis: kelompok dengan ambang rujuk tercapai ditandai
// "Ambang Tercapai", sisanya "Dalam Pemantauan".
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const anak = await query<{ id: string }>(
      "SELECT id FROM children WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (anak.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }

    const skrining = await query<Record<string, unknown>>(
      `SELECT s.id, s.jenis, s.status, s.tahap, s.created_at,
              l.id AS laporan_id, l.status AS laporan_status, l.indikasi, l.updated_at AS laporan_updated_at
         FROM skrining s
         LEFT JOIN laporan_skrining l ON l.skrining_id = s.id
        WHERE s.child_id = $1
        ORDER BY s.created_at DESC, l.updated_at DESC NULLS LAST
        LIMIT 1`,
      [params.id]
    );
    if (skrining.length === 0) {
      return NextResponse.json({ ok: true, ada: false });
    }
    const s = skrining[0];

    let baris: BarisIndikasi[] = [];
    if (s.indikasi) {
      try {
        const mentah = typeof s.indikasi === "string" ? JSON.parse(s.indikasi) : s.indikasi;
        if (Array.isArray(mentah)) baris = mentah as BarisIndikasi[];
      } catch {
        baris = [];
      }
    }

    const perKelompok = new Map<string, { kelompok: string; ambang_tercapai: boolean; indikator: string[]; catatan: string[] }>();
    for (const b of baris) {
      const kunci = String(b.kelompok || "Kelompok lain");
      const ada = perKelompok.get(kunci) || { kelompok: kunci, ambang_tercapai: false, indikator: [], catatan: [] };
      if (b.ambang) ada.ambang_tercapai = true;
      if (b.indikator) ada.indikator.push(String(b.indikator));
      if (b.catatan) ada.catatan.push(String(b.catatan));
      perKelompok.set(kunci, ada);
    }

    const rujukan = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM berkas_rujukan
        WHERE child_id = $1 AND status NOT IN ('selesai', 'dibatalkan', 'ditolak')`,
      [params.id]
    );

    return NextResponse.json({
      ok: true,
      ada: true,
      skrining_id: s.id,
      jenis: s.jenis,
      jenis_label: LABEL_JENIS_SKRINING[String(s.jenis)] || String(s.jenis),
      status: s.status,
      tahap: s.tahap,
      laporan_status: s.laporan_status || null,
      kelompok: [...perKelompok.values()],
      rujukan_aktif: Number(rujukan[0]?.n || 0),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
