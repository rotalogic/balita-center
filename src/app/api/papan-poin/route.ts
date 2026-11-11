import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { ASPEK_PENILAIAN_GURU, POIN_DARI_KATA } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

const adalahPimpinan = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder", "branch_manager", "manager"].includes(r));

// Papan Poin Guru: poin internal hasil ubahan penilaian wali murid.
// - Founder & manager: urutan semua guru pada periode berjalan (bahan KPI).
// - Guru: hasil penilaiannya sendiri — rata-rata per aspek dan cerita orang
//   tua TANPA nama penilai (identitas penilai tidak pernah dibuka).
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const periode = /^\d{4}-\d{2}$/.test(url.searchParams.get("periode") || "")
      ? String(url.searchParams.get("periode"))
      : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());

    if (adalahPimpinan(denied.user)) {
      const papan = await query(
        `SELECT s.id AS staff_id, s.full_name AS staff_name,
                COUNT(p.id)::int AS jumlah_penilai,
                ROUND(AVG(p.poin), 2)::float8 AS rata_poin
           FROM penilaian_guru p
           JOIN staff s ON s.id = p.staff_id
          WHERE p.periode = $1
          GROUP BY s.id, s.full_name
          ORDER BY rata_poin DESC, jumlah_penilai DESC`,
        [periode]
      );
      return NextResponse.json({ ok: true, mode: "papan", periode, papan });
    }

    const stafSaya = await query<{ id: string; full_name: string }>(
      "SELECT id, full_name FROM staff WHERE user_id = $1 AND deleted_at IS NULL", [denied.user.id]
    );
    if (stafSaya.length === 0) {
      return NextResponse.json({ ok: false, error: "Papan Poin hanya untuk founder, manager, dan guru yang dinilai." }, { status: 403 });
    }
    const baris = await query<{ aspek: Record<string, string>; cerita: string | null }>(
      "SELECT aspek, cerita FROM penilaian_guru WHERE staff_id = $1 AND periode = $2 ORDER BY created_at DESC",
      [stafSaya[0].id, periode]
    );
    const perAspek: Record<string, number | null> = {};
    for (const [kunci] of ASPEK_PENILAIAN_GURU) {
      const nilai = baris.map((b) => POIN_DARI_KATA[String(b.aspek?.[kunci] || "")]).filter((n) => typeof n === "number");
      perAspek[kunci] = nilai.length ? Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 100) / 100 : null;
    }
    return NextResponse.json({
      ok: true, mode: "sendiri", periode,
      staff_name: stafSaya[0].full_name,
      jumlah_penilai: baris.length,
      per_aspek: perAspek,
      cerita: baris.map((b) => b.cerita).filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
