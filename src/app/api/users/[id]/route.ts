import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { query } from "@/lib/db";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Body = { role?: string; is_active?: boolean; status?: string; branch_id?: string | null; staff_id?: string | null };

const STATUS_VALID = ["aktif", "menunggu_persetujuan", "nonaktif"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("users.manage");
  if (denied.error) return denied.error;
  const actor = denied.user;

  const body = (await request.json().catch(() => ({}))) as Body;

  const rows = await query<{ id: string; role: string; is_active: boolean; email: string }>(
    "SELECT id, role, is_active, email FROM users WHERE id = $1 AND deleted_at IS NULL",
    [params.id]
  );
  const target = rows[0];
  if (!target) {
    return NextResponse.json({ ok: false, error: "User tidak ditemukan." }, { status: 404 });
  }

  // Cegah mengunci diri sendiri: jangan ubah peran/status akun sendiri.
  if (
    target.id === actor.id &&
    (body.role !== undefined || body.is_active !== undefined || body.status !== undefined)
  ) {
    return NextResponse.json(
      { ok: false, error: "Tidak bisa mengubah peran atau status akun sendiri." },
      { status: 400 }
    );
  }

  if (body.status !== undefined) {
    if (!STATUS_VALID.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `Status harus salah satu: ${STATUS_VALID.join(", ")}.` },
        { status: 400 }
      );
    }
    await query(
      "UPDATE users SET status = $1, is_active = ($1 <> 'nonaktif'), updated_at = now() WHERE id = $2",
      [body.status, target.id]
    );
  }

  if (body.role !== undefined) {
    const valid = await query<{ code: string }>("SELECT code FROM roles WHERE code = $1", [body.role]);
    if (!valid.length) {
      return NextResponse.json({ ok: false, error: `Peran "${body.role}" tidak dikenal.` }, { status: 400 });
    }
    await query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2", [body.role, target.id]);
  }

  if (body.branch_id !== undefined) {
    await query("DELETE FROM user_branches WHERE user_id = $1", [target.id]);
    if (body.branch_id) {
      await query(
        "INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ($1,$2,true) ON CONFLICT DO NOTHING",
        [target.id, body.branch_id]
      );
    }
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ ok: false, error: "is_active harus boolean." }, { status: 400 });
    }
    await query("UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2", [
      body.is_active,
      target.id,
    ]);
  }

  // Penautan akun ↔ staf (Blok 3B): satu staf hanya boleh punya satu akun.
  if (body.staff_id !== undefined) {
    if (body.staff_id) {
      const staf = await query<{ id: string; full_name: string; user_id: string | null }>(
        "SELECT id, full_name, user_id FROM staff WHERE id = $1",
        [body.staff_id]
      );
      if (!staf[0]) {
        return NextResponse.json({ ok: false, error: "Staf tidak ditemukan." }, { status: 404 });
      }
      if (staf[0].user_id && staf[0].user_id !== target.id) {
        return NextResponse.json(
          { ok: false, error: `Staf ${staf[0].full_name} sudah tertaut ke akun lain. Lepas dulu di akun itu.` },
          { status: 409 }
        );
      }
      await query("UPDATE staff SET user_id = NULL WHERE user_id = $1 AND id <> $2", [target.id, body.staff_id]);
      await query("UPDATE staff SET user_id = $1 WHERE id = $2", [target.id, body.staff_id]);
    } else {
      await query("UPDATE staff SET user_id = NULL WHERE user_id = $1", [target.id]);
    }
  }

  await catatAudit(actor, {
    action: body.staff_id !== undefined ? "user.link_staff" : "user.update",
    entityTable: "users",
    entityId: target.id,
    detail: { email: target.email, ...body },
  });

  const updated = await query(
    "SELECT id, role, is_active, status, email FROM users WHERE id = $1",
    [target.id]
  );

  return NextResponse.json({ ok: true, user: updated[0] });
}
