import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard, hasPermission } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Blok 1 Jilid 4: TIDAK ADA hard delete rekaman anak.
// DELETE = soft delete (masuk Sampah, bisa dipulihkan Super Admin, teraudit).
// Trigger database menolak DELETE fisik, jadi jalur lain pun tidak bisa lolos.

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  if (!hasPermission(denied.user, "students.update") && !denied.user.roles.includes("super_admin")) {
    return NextResponse.json({ ok: false, error: "Hanya yang berhak mengubah data anak yang bisa menghapus." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const rows = await query<{ id: string; full_name: string; branch_id: string; deleted_at: string | null }>(
      "SELECT id, full_name, branch_id, deleted_at FROM children WHERE id = $1::uuid",
      [params.id]
    );
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    if (rows[0].deleted_at) {
      return NextResponse.json({ ok: false, error: "Anak ini sudah ada di Sampah." }, { status: 409 });
    }

    await query(
      `UPDATE children SET deleted_at = now(), deleted_by = $2::uuid, deleted_reason = $3::text, updated_at = now()
        WHERE id = $1::uuid`,
      [params.id, denied.user.id, (body.reason || "").trim() || null]
    );

    await catatAudit(denied.user, {
      action: "child.soft_delete",
      entityTable: "children",
      entityId: params.id,
      branchId: rows[0].branch_id,
      detail: { anak: rows[0].full_name, alasan: (body.reason || "").trim() || null },
    });

    return NextResponse.json({ ok: true, deleted: true, dapat_dipulihkan: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// Pulihkan dari Sampah. Hanya Super Admin.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  if (!denied.user.roles.includes("super_admin")) {
    return NextResponse.json({ ok: false, error: "Hanya Super Admin yang bisa memulihkan data anak." }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { restore?: boolean };
    if (!body.restore) {
      return NextResponse.json({ ok: false, error: "Hanya aksi restore yang didukung di sini." }, { status: 400 });
    }
    const rows = await query<{ id: string; full_name: string; branch_id: string; deleted_at: string | null }>(
      "SELECT id, full_name, branch_id, deleted_at FROM children WHERE id = $1::uuid",
      [params.id]
    );
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    if (!rows[0].deleted_at) return NextResponse.json({ ok: false, error: "Anak ini tidak sedang di Sampah." }, { status: 409 });

    await query(
      "UPDATE children SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, updated_at = now() WHERE id = $1::uuid",
      [params.id]
    );
    await catatAudit(denied.user, {
      action: "child.restore",
      entityTable: "children",
      entityId: params.id,
      branchId: rows[0].branch_id,
      detail: { anak: rows[0].full_name },
    });
    return NextResponse.json({ ok: true, restored: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
