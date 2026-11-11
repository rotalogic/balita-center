import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { ASPEK_PENILAIAN_GURU, POIN_DARI_KATA, SKALA_MASUKAN } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

const KUNCI_ASPEK = ASPEK_PENILAIAN_GURU.map(([k]) => k);
const KATA_SAH = new Set<string>(SKALA_MASUKAN as unknown as string[]);

function periodeKini(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
}

// Penilaian Guru oleh Wali Murid: orang tua menilai guru kelas anaknya pada
// empat aspek berskala kata. Poin internal dihitung server dari kata yang
// dipilih — tidak pernah dikirim penilai dan tidak tampil sebagai bintang.
export async function GET() {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  try {
    const guruAnak = await query<{ child_id: string; child_name: string; staff_id: string; staff_name: string; class_name: string }>(
      `SELECT c.id AS child_id, c.full_name AS child_name, s.id AS staff_id, s.full_name AS staff_name, cl.name AS class_name
         FROM children c
         JOIN child_guardians cg ON cg.child_id = c.id
         JOIN guardians g ON g.id = cg.guardian_id
         JOIN enrollments e ON e.child_id = c.id AND e.status = 'aktif'
         JOIN classes cl ON cl.id = e.class_id
         JOIN staff s ON s.id = cl.lead_staff_id
        WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL
        ORDER BY c.full_name`,
      [denied.user.email]
    );
    const penilaian = await query(
      "SELECT * FROM penilaian_guru WHERE guardian_email = $1 ORDER BY created_at DESC",
      [denied.user.email]
    );
    return NextResponse.json({ ok: true, guru_anak: guruAnak, penilaian, periode: periodeKini() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const childId = String(body.child_id || "");
    const staffId = String(body.staff_id || "");
    // Guru yang dinilai harus guru kelas anak penilai.
    const sah = await query(
      `SELECT 1 AS ok
         FROM children c
         JOIN child_guardians cg ON cg.child_id = c.id
         JOIN guardians g ON g.id = cg.guardian_id
         JOIN enrollments e ON e.child_id = c.id AND e.status = 'aktif'
         JOIN classes cl ON cl.id = e.class_id
        WHERE lower(g.email) = lower($1) AND c.id = $2 AND cl.lead_staff_id = $3 AND c.deleted_at IS NULL`,
      [denied.user.email, childId, staffId]
    );
    if (sah.length === 0) {
      return NextResponse.json({ ok: false, error: "Guru tersebut bukan guru kelas anak Anda." }, { status: 403 });
    }
    const aspek = (body.aspek || {}) as Record<string, string>;
    let total = 0;
    for (const kunci of KUNCI_ASPEK) {
      const kata = String(aspek[kunci] || "");
      if (!KATA_SAH.has(kata)) {
        return NextResponse.json(
          { ok: false, error: "Setiap aspek wajib dinilai dengan kata: Sangat Baik, Baik, Cukup, atau Perlu Perbaikan." },
          { status: 400 }
        );
      }
      total += POIN_DARI_KATA[kata];
    }
    const poin = Math.round((total / KUNCI_ASPEK.length) * 100) / 100;
    const periode = periodeKini();
    await query(
      `INSERT INTO penilaian_guru (staff_id, child_id, guardian_email, periode, aspek, poin, cerita)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       ON CONFLICT (child_id, staff_id, periode, guardian_email)
       DO UPDATE SET aspek = EXCLUDED.aspek, poin = EXCLUDED.poin, cerita = EXCLUDED.cerita, updated_at = now()`,
      [staffId, childId, denied.user.email, periode, JSON.stringify(aspek), poin, body.cerita ? String(body.cerita) : null]
    );
    return NextResponse.json({ ok: true, periode });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan penilaian guru.") }, { status: 500 });
  }
}
