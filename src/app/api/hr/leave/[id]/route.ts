import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const KEPUTUSAN = ["disetujui", "ditolak", "dibatalkan"];

// Setujui / tolak / batalkan pengajuan. decided_by bertipe staff(id) — diambil
// dari AKUN YANG LOGIN (lewat staff.user_id), bukan dari pilihan di layar.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("hr.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { status?: string };
    if (!KEPUTUSAN.includes(body.status || "")) {
      return NextResponse.json(
        { ok: false, error: `Status harus salah satu: ${KEPUTUSAN.join(", ")}.` },
        { status: 400 }
      );
    }

    const rows = await query<{ id: string; status: string; staff_name: string; branch_id: string | null }>(
      `SELECT l.id, l.status, s.full_name AS staff_name, l.branch_id
         FROM leave_requests l JOIN staff s ON s.id = l.staff_id
        WHERE l.id = $1`,
      [params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Pengajuan tidak ditemukan." }, { status: 404 });
    }
    if (rows[0].status !== "menunggu" && body.status !== "dibatalkan") {
      return NextResponse.json(
        { ok: false, error: `Pengajuan sudah berstatus ${rows[0].status}.` },
        { status: 409 }
      );
    }

    const staf = await query<{ id: string }>(
      `SELECT id FROM staff
        WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2))
        ORDER BY (user_id = $1) DESC LIMIT 1`,
      [denied.user.id, denied.user.email]
    );
    if (!staf[0]) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Akun Anda belum tertaut ke data staf, jadi tidak bisa memutuskan. Minta Super Admin menautkan di menu Pengguna.",
        },
        { status: 400 }
      );
    }

    await query(
      `UPDATE leave_requests
          SET status = $1, decided_by = $2, decided_at = now(), updated_at = now()
        WHERE id = $3`,
      [body.status, staf[0].id, params.id]
    );
    await catatAudit(denied.user, {
      action: `leave.${body.status === "disetujui" ? "approve" : body.status === "ditolak" ? "reject" : "cancel"}`,
      entityTable: "leave_requests",
      entityId: params.id,
      branchId: rows[0].branch_id,
      detail: { staf: rows[0].staff_name, dari: rows[0].status, ke: body.status },
    });
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
