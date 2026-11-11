import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const adalahPimpinan = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder", "branch_manager", "manager"].includes(r));

// Rekap Masukan Orang Tua untuk admin & founder beserta tindak lanjutnya.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query("SELECT * FROM masukan_ortu ORDER BY created_at DESC LIMIT 300");
    return NextResponse.json({ ok: true, masukan: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  if (!adalahPimpinan(denied.user)) {
    return NextResponse.json({ ok: false, error: "Tindak lanjut masukan adalah wewenang founder/manager." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const status = String(body.status || "");
    if (!["baru", "dibaca", "ditindaklanjuti"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Status tindak lanjut tidak dikenal." }, { status: 400 });
    }
    if (status === "ditindaklanjuti" && String(body.tindak_lanjut || "").trim().length < 3) {
      return NextResponse.json({ ok: false, error: "Catatan tindak lanjut wajib diisi." }, { status: 400 });
    }
    await query(
      `UPDATE masukan_ortu SET status = $2, tindak_lanjut = COALESCE($3, tindak_lanjut),
         ditindak_oleh = $4, updated_at = now() WHERE id = $1`,
      [String(body.id || ""), status, body.tindak_lanjut ? String(body.tindak_lanjut) : null, denied.user.id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menindaklanjuti masukan.") }, { status: 500 });
  }
}
