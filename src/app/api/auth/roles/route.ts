import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Peran yang boleh dipilih saat mendaftar sendiri.
// super_admin sengaja dikecualikan — hanya bisa diberikan lewat /pengguna.
const EXCLUDED = ["super_admin"];

export async function GET() {
  try {
    const roles = await query<{ code: string; name: string }>(
      `SELECT code, name FROM roles
        WHERE code <> ALL($1::text[])
        ORDER BY
          CASE code
            WHEN 'orang_tua' THEN 0
            WHEN 'murid' THEN 1
            WHEN 'guru' THEN 2
            ELSE 3
          END, name`,
      [EXCLUDED]
    );
    return NextResponse.json({ ok: true, roles });
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal memuat peran.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
