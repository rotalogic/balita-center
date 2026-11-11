import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { JENIS_SKRINING } from "@/lib/skrining";

export const dynamic = "force-dynamic";

const JENIS_SAH = new Set(JENIS_SKRINING.map(([k]) => k));

// Daftar pemeriksaan Layanan Skrining Berdiri Sendiri.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT s.*, l.status AS laporan_status
         FROM skrining s
         LEFT JOIN laporan_skrining l ON l.skrining_id = s.id
        WHERE ($1::uuid[] IS NULL OR s.branch_id = ANY($1::uuid[]) OR s.branch_id IS NULL)
        ORDER BY s.created_at DESC
        LIMIT 300`,
      [scope]
    );
    return NextResponse.json({ ok: true, skrining: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Pendaftaran klien skrining — status anak Klien Skrining berdiri sendiri,
// terpisah dari Anggota/Trial/Insidentil/Peserta Event, dan tidak mengubah
// status anak pada jalur lain yang sedang dijalaninya.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const jenis = String(body.jenis || "");
    if (!JENIS_SAH.has(jenis)) {
      return NextResponse.json(
        { ok: false, error: "Jenis skrining tidak dikenal. Taksonomi aktif hanya memuat tujuh jenis final." },
        { status: 400 }
      );
    }
    const childName = String(body.child_name || "").trim();
    const parentName = String(body.parent_name || "").trim();
    const wa = String(body.wa_number || "").replace(/[^\d+]/g, "");
    if (childName.length < 2 || parentName.length < 2 || wa.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Nama anak, nama orang tua, dan nomor WhatsApp wajib diisi." },
        { status: 400 }
      );
    }
    const scope = branchScope(denied.user);
    const branchId = body.branch_id ? String(body.branch_id) : scope?.[0] || null;
    if (scope && branchId && !scope.includes(branchId)) {
      return NextResponse.json({ ok: false, error: "Cabang di luar cakupan Anda." }, { status: 403 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO skrining
         (branch_id, child_id, child_name, child_birth_date, parent_name, wa_number, email, jenis, biaya, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        branchId,
        body.child_id ? String(body.child_id) : null,
        childName,
        body.child_birth_date ? String(body.child_birth_date).slice(0, 10) : null,
        parentName,
        wa,
        body.email ? String(body.email) : null,
        jenis,
        body.biaya !== undefined && body.biaya !== "" ? Number(body.biaya) : null,
        denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "skrining.create", entityTable: "skrining", entityId: rows[0].id, branchId,
      detail: { anak: childName, jenis },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mendaftarkan klien skrining.") }, { status: 500 });
  }
}
