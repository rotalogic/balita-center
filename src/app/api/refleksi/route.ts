import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Refleksi Guru harian: penulis membaca miliknya; founder & manager membaca
// semua di cakupannya sebagai bahan pembinaan. Tidak ada jalur ke orang tua.
const PERAN_PEMBINA = ["owner", "super_admin", "branch_manager", "founder"];

export async function GET(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const tanggal = (searchParams.get("tanggal") || "").trim();
    const pembina = denied.user.roles.some((r) => PERAN_PEMBINA.includes(r));
    const scopeIds = branchScope(denied.user);
    const where: string[] = [];
    const params: unknown[] = [];
    if (!pembina) {
      params.push(denied.user.id);
      where.push(`r.penulis_id = $${params.length}`);
    } else if (scopeIds) {
      params.push(scopeIds);
      where.push(`(r.branch_id = ANY($${params.length}::uuid[]) OR r.branch_id IS NULL)`);
    }
    if (tanggal) { params.push(tanggal); where.push(`r.tanggal = $${params.length}`); }
    const rows = await query(
      `SELECT r.*, c.name AS class_name, u.full_name AS penulis_nama
         FROM refleksi_guru r
         LEFT JOIN classes c ON c.id = r.class_id
         JOIN users u ON u.id = r.penulis_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY r.tanggal DESC, r.created_at DESC
        LIMIT 100`,
      params
    );
    return NextResponse.json({ ok: true, refleksi: rows, pembina });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tanggal = String(body.tanggal || "").slice(0, 10);
    const dipelajari = String(body.dipelajari || "").trim();
    const perubahan = String(body.perubahan || "").trim();
    const kesadaran = String(body.kesadaran || "").trim();
    if (!tanggal || !dipelajari || !perubahan || !kesadaran) {
      return NextResponse.json(
        { ok: false, error: "Refleksi wajib lengkap: yang dipelajari, perubahan yang perlu dilakukan, dan kesadaran diri." },
        { status: 400 }
      );
    }
    let branchId: string | null = body.branch_id ? String(body.branch_id) : null;
    let classId: string | null = body.class_id ? String(body.class_id) : null;
    if (classId) {
      const kelas = await query<{ branch_id: string }>("SELECT branch_id FROM classes WHERE id = $1", [classId]);
      if (kelas.length === 0) classId = null;
      else branchId = kelas[0].branch_id;
    }
    const scopeIds = branchScope(denied.user);
    if (branchId && scopeIds && !scopeIds.includes(branchId)) {
      return NextResponse.json({ ok: false, error: "Kelas di luar cakupan cabang Anda." }, { status: 403 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO refleksi_guru (branch_id, class_id, tanggal, penulis_id, dipelajari, perubahan, kesadaran)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [branchId, classId, tanggal, denied.user.id, dipelajari, perubahan, kesadaran]
    );
    await catatAudit(denied.user, {
      action: "refleksi.create",
      entityTable: "refleksi_guru",
      entityId: rows[0].id,
      branchId: branchId || undefined,
      detail: { tanggal },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
