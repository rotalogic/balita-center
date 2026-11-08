import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Pencarian cepat di kolom atas: anak, staf, pengguna, kelas, cabang.
// Menu statis dicari di sisi klien (tidak perlu round-trip).
export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, hasil: [] });
  const pola = `%${q}%`;
  const scope = branchScope(denied.user);

  try {
    const [anak, staf, pengguna, kelas] = await Promise.all([
      query<{ id: string; full_name: string; branch_name: string | null }>(
        `SELECT c.id, c.full_name, b.name AS branch_name FROM children c
           LEFT JOIN branches b ON b.id = c.branch_id
          WHERE c.deleted_at IS NULL AND c.full_name ILIKE $1
            AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2::uuid[]))
          ORDER BY c.full_name LIMIT 5`,
        [pola, scope]
      ),
      query<{ id: string; full_name: string; position: string | null }>(
        `SELECT id, full_name, position FROM staff
          WHERE deleted_at IS NULL AND full_name ILIKE $1 LIMIT 4`,
        [pola]
      ),
      query<{ id: string; full_name: string; email: string }>(
        `SELECT id, full_name, email FROM users
          WHERE deleted_at IS NULL AND (full_name ILIKE $1 OR email ILIKE $1) LIMIT 4`,
        [pola]
      ),
      query<{ id: string; name: string; branch_name: string | null }>(
        `SELECT c.id, c.name, b.name AS branch_name FROM classes c
           LEFT JOIN branches b ON b.id = c.branch_id
          WHERE c.deleted_at IS NULL AND c.name ILIKE $1 LIMIT 4`,
        [pola]
      ),
    ]);

    const hasil = [
      ...anak.map((r) => ({ jenis: "Anak", label: r.full_name, ket: r.branch_name || "", href: `/anak/${r.id}` })),
      ...kelas.map((r) => ({ jenis: "Kelas", label: r.name, ket: r.branch_name || "", href: "/akademik" })),
      ...staf.map((r) => ({ jenis: "Staf", label: r.full_name, ket: r.position || "", href: "/sdm" })),
      ...pengguna.map((r) => ({ jenis: "Pengguna", label: r.full_name, ket: r.email, href: "/pengguna" })),
    ].slice(0, 10);

    return NextResponse.json({ ok: true, hasil });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message, hasil: [] }, { status: 503 });
  }
}
