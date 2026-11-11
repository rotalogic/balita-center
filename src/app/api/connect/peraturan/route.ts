import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { KESEPAKATAN } from "@/lib/kesepakatan";

export const dynamic = "force-dynamic";

// Portal Orang Tua hanya menampilkan Aturan Orang Tua dan Aturan Anak versi
// ramah anak — ditegakkan di server, bukan sekadar disembunyikan di layar.
// Kesepakatan Awal Keluarga anak-anak mereka ikut ditampilkan statusnya.
export async function GET() {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  try {
    const peraturan = await query(
      "SELECT jenis, judul, isi, updated_at FROM peraturan WHERE jenis IN ('ortu','anak_ramah') ORDER BY CASE jenis WHEN 'ortu' THEN 1 ELSE 2 END"
    );

    const anakSaya = await query<{ id: string; full_name: string }>(
      `SELECT c.id, c.full_name
         FROM children c
         JOIN child_guardians cg ON cg.child_id = c.id
         JOIN guardians g ON g.id = cg.guardian_id
        WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL
        ORDER BY c.full_name`,
      [denied.user.email]
    );

    const kesepakatan = [];
    for (const anak of anakSaya) {
      const tercatat = await query<{ nama_penyetuju: string; disetujui_at: string; sumber: string }>(
        "SELECT nama_penyetuju, disetujui_at, sumber FROM kesepakatan_keluarga WHERE child_id = $1",
        [anak.id]
      );
      const dariTrial = tercatat.length === 0
        ? await query<{ nama_penyetuju: string; disetujui_at: string }>(
            `SELECT l.parent_name AS nama_penyetuju, f.kesepakatan_awal_at AS disetujui_at
               FROM leads l JOIN trial_forms f ON f.lead_id = l.id
              WHERE l.converted_child_id = $1 AND f.kesepakatan_awal`,
            [anak.id]
          )
        : [];
      const sumber = tercatat[0] || (dariTrial[0] ? { ...dariTrial[0], sumber: "trial" } : null);
      kesepakatan.push({
        child_id: anak.id,
        child_name: anak.full_name,
        disetujui: Boolean(sumber),
        nama_penyetuju: sumber?.nama_penyetuju || null,
        disetujui_at: sumber?.disetujui_at || null,
        sumber: sumber?.sumber || null,
      });
    }

    return NextResponse.json({ ok: true, peraturan, kesepakatan_teks: KESEPAKATAN, kesepakatan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
