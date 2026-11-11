import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { ASPEK_MASUKAN, SKALA_MASUKAN } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

const KUNCI_ASPEK = new Set(ASPEK_MASUKAN.map(([k]) => k));
const KATA_SAH = new Set<string>(SKALA_MASUKAN as unknown as string[]);

function periodeKini(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
}

async function anakSaya(email: string) {
  return query<{ id: string; full_name: string }>(
    `SELECT c.id, c.full_name
       FROM children c
       JOIN child_guardians cg ON cg.child_id = c.id
       JOIN guardians g ON g.id = cg.guardian_id
      WHERE lower(g.email) = lower($1) AND c.deleted_at IS NULL
      ORDER BY c.full_name`,
    [email]
  );
}

// Masukan Orang Tua berkala: penilaian kata pada empat aspek + cerita bebas.
export async function GET() {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  try {
    const anak = await anakSaya(denied.user.email || "");
    const masukan = anak.length
      ? await query(
          "SELECT * FROM masukan_ortu WHERE guardian_email = $1 ORDER BY created_at DESC",
          [denied.user.email]
        )
      : [];
    return NextResponse.json({ ok: true, anak, masukan, periode: periodeKini() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("child.view_own");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const anak = await anakSaya(denied.user.email || "");
    const target = anak.find((a) => a.id === String(body.child_id || ""));
    if (!target) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan pada akun Anda." }, { status: 403 });
    }
    const aspek = (body.aspek || {}) as Record<string, string>;
    for (const kunci of KUNCI_ASPEK) {
      if (!KATA_SAH.has(String(aspek[kunci] || ""))) {
        return NextResponse.json(
          { ok: false, error: "Setiap aspek wajib dinilai dengan kata: Sangat Baik, Baik, Cukup, atau Perlu Perbaikan." },
          { status: 400 }
        );
      }
    }
    const periode = periodeKini();
    await query(
      `INSERT INTO masukan_ortu (child_id, child_name, guardian_email, periode, aspek, cerita)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)
       ON CONFLICT (child_id, periode, guardian_email)
       DO UPDATE SET aspek = EXCLUDED.aspek, cerita = EXCLUDED.cerita, updated_at = now()`,
      [target.id, target.full_name, denied.user.email, periode, JSON.stringify(aspek), body.cerita ? String(body.cerita) : null]
    );
    return NextResponse.json({ ok: true, periode });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan masukan.") }, { status: 500 });
  }
}
