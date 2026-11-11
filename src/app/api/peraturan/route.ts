import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const JENIS = ["guru", "anak", "anak_ramah", "ortu"] as const;
const BOLEH_UBAH = ["owner", "super_admin", "branch_manager"];

// Peraturan & Kesepakatan Bersama — akses ditegakkan di server:
// staf membaca perangkat aturan; hanya founder & manager yang memperbarui.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query(
      `SELECT p.*, u.full_name AS diubah_oleh_nama
         FROM peraturan p LEFT JOIN users u ON u.id = p.updated_by
        ORDER BY CASE p.jenis WHEN 'guru' THEN 1 WHEN 'anak' THEN 2 WHEN 'anak_ramah' THEN 3 ELSE 4 END`
    );
    const bolehUbah = [...denied.user.roles, denied.user.role].some((r) => BOLEH_UBAH.includes(r));
    return NextResponse.json({ ok: true, peraturan: rows, boleh_ubah: bolehUbah });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const bolehUbah = [...denied.user.roles, denied.user.role].some((r) => BOLEH_UBAH.includes(r));
  if (!bolehUbah) {
    return NextResponse.json(
      { ok: false, error: "Hanya founder dan manager yang dapat memperbarui peraturan lembaga." },
      { status: 403 }
    );
  }
  try {
    const body = (await request.json()) as { jenis?: string; judul?: string; isi?: string };
    if (!body.jenis || !(JENIS as readonly string[]).includes(body.jenis)) {
      return NextResponse.json({ ok: false, error: "Jenis peraturan tidak dikenal." }, { status: 400 });
    }
    if (!String(body.isi || "").trim()) {
      return NextResponse.json({ ok: false, error: "Isi peraturan tidak boleh kosong." }, { status: 400 });
    }
    await query(
      `INSERT INTO peraturan (jenis, judul, isi, updated_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (jenis) DO UPDATE SET judul = EXCLUDED.judul, isi = EXCLUDED.isi,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [body.jenis, String(body.judul || "").trim() || "Peraturan", String(body.isi).trim(), denied.user.id]
    );
    await catatAudit(denied.user, {
      action: "peraturan.update",
      entityTable: "peraturan",
      detail: { jenis: body.jenis },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(error, "Gagal memperbarui peraturan.") },
      { status: 500 }
    );
  }
}
