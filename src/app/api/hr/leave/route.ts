import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard, hasPermission } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const KINDS = ["cuti", "izin", "lembur"];

// Staf milik akun yang login: utamakan tautan eksplisit staff.user_id,
// email hanya cadangan untuk data lama (migrasi-blok-1-2.sql menautkan otomatis).
async function stafSaya(userId: string, email: string) {
  const rows = await query<{ id: string; full_name: string; branch_id: string | null }>(
    `SELECT id, full_name, branch_id FROM staff
      WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2))
      ORDER BY (user_id = $1) DESC LIMIT 1`,
    [userId, email]
  );
  return rows[0] ?? null;
}

export async function GET(request: Request) {
  const denied = await guard("hr.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const status = new URL(request.url).searchParams.get("status") || "";
    const rows = await query(
      `SELECT l.*, s.full_name AS staff_name, b.name AS branch_name,
              d.full_name AS decided_by_name
         FROM leave_requests l
         JOIN staff s ON s.id = l.staff_id
         LEFT JOIN branches b ON b.id = l.branch_id
         LEFT JOIN staff d ON d.id = l.decided_by
        WHERE ($1::uuid[] IS NULL OR l.branch_id = ANY($1::uuid[]))
          AND ($2 = '' OR l.status = $2)
        ORDER BY l.created_at DESC LIMIT 200`,
      [scope, status]
    );
    const ringkas = await query<{ status: string; total: number }>(
      `SELECT status, COUNT(*)::int AS total FROM leave_requests
        WHERE ($1::uuid[] IS NULL OR branch_id = ANY($1::uuid[]))
        GROUP BY status`,
      [scope]
    );
    const counts: Record<string, number> = { menunggu: 0, disetujui: 0, ditolak: 0, dibatalkan: 0 };
    for (const row of ringkas) counts[row.status] = row.total;

    // Pemilih staf hanya untuk yang berhak mengajukan atas nama orang lain.
    const bolehPilih = hasPermission(denied.user, "hr.manage");
    const staf = bolehPilih
      ? await query(
          `SELECT s.id, s.full_name, s.position, s.branch_id, b.name AS branch_name
             FROM staff s LEFT JOIN branches b ON b.id = s.branch_id
            WHERE s.status IS DISTINCT FROM 'nonaktif'
              AND ($1::uuid[] IS NULL OR s.branch_id = ANY($1::uuid[]))
            ORDER BY s.full_name LIMIT 300`,
          [scope]
        )
      : [];

    return NextResponse.json({
      ok: true,
      requests: rows,
      counts,
      me: await stafSaya(denied.user.id, denied.user.email),
      staff: staf,
      canPickStaff: bolehPilih,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Pengajuan cuti/izin/lembur.
export async function POST(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      kind?: string;
      start_date?: string;
      end_date?: string;
      reason?: string;
      staff_id?: string;
    };

    if (!KINDS.includes(body.kind || "")) {
      return NextResponse.json({ ok: false, error: `Jenis harus salah satu: ${KINDS.join(", ")}.` }, { status: 400 });
    }
    if (!body.start_date || !body.end_date) {
      return NextResponse.json({ ok: false, error: "Tanggal mulai dan selesai wajib diisi." }, { status: 400 });
    }
    if (body.end_date < body.start_date) {
      return NextResponse.json({ ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });
    }

    const saya = await stafSaya(denied.user.id, denied.user.email);
    let staf = saya;

    // Pemohon lain hanya boleh atas nama orang lain bila punya hr.manage.
    if (body.staff_id && body.staff_id !== saya?.id) {
      if (!hasPermission(denied.user, "hr.manage")) {
        return NextResponse.json(
          { ok: false, error: "Hanya Kepala Sekolah/Admin Cabang yang boleh mengajukan atas nama staf lain." },
          { status: 403 }
        );
      }
      const pilih = await query<{ id: string; full_name: string; branch_id: string | null }>(
        "SELECT id, full_name, branch_id FROM staff WHERE id = $1",
        [body.staff_id]
      );
      if (!pilih[0]) {
        return NextResponse.json({ ok: false, error: "Staf pemohon tidak ditemukan." }, { status: 404 });
      }
      const scope = branchScope(denied.user);
      if (scope && pilih[0].branch_id && !scope.includes(pilih[0].branch_id)) {
        return NextResponse.json({ ok: false, error: "Staf itu bukan di cabang Anda." }, { status: 403 });
      }
      staf = pilih[0];
    }

    if (!staf) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Akun Anda belum tertaut ke data staf. Minta Super Admin menautkannya di menu Pengguna → kolom Akun Staf.",
        },
        { status: 400 }
      );
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO leave_requests (branch_id, staff_id, kind, start_date, end_date, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,'menunggu') RETURNING id`,
      [staf.branch_id, staf.id, body.kind, body.start_date, body.end_date, (body.reason || "").trim() || null]
    );
    await catatAudit(denied.user, {
      action: "leave.create",
      entityTable: "leave_requests",
      entityId: rows[0].id,
      branchId: staf.branch_id,
      detail: {
        staf: staf.full_name,
        jenis: body.kind,
        mulai: body.start_date,
        selesai: body.end_date,
        atas_nama: staf.id !== saya?.id ? "dibuat admin" : "diri sendiri",
      },
    });
    return NextResponse.json({ ok: true, id: rows[0].id, staff_name: staf.full_name });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
