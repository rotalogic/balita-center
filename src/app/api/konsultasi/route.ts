import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { USIA_MINIMUM_BULAN, umurBulanDariLahir } from "@/lib/minat";

export const dynamic = "force-dynamic";

// Daftar Klien Konsultasi Terdaftar (Konsultasi dan Pemetaan Bakat Minat).
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT * FROM konsultasi
        WHERE ($1::uuid[] IS NULL OR branch_id = ANY($1::uuid[]) OR branch_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 300`,
      [scope]
    );
    return NextResponse.json({ ok: true, konsultasi: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Pendaftaran Klien Konsultasi. Gerbang usia ditegakkan di lapisan server:
// layanan tersendiri ini dibuka mulai usia empat tahun; anak di bawahnya
// diarahkan kepada pembacaan Profil Cara Belajar pada laporan program
// kelas yang ia ikuti.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const childName = String(body.child_name || "").trim();
    const parentName = String(body.parent_name || "").trim();
    const wa = String(body.wa_number || "").replace(/[^\d+]/g, "");
    const lahir = String(body.child_birth_date || "").slice(0, 10);
    if (childName.length < 2 || parentName.length < 2 || wa.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Nama anak, nama orang tua, dan nomor WhatsApp wajib diisi." },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lahir)) {
      return NextResponse.json(
        { ok: false, error: "Tanggal lahir anak wajib diisi — aturan usia layanan ini ditegakkan dari tanggal lahir." },
        { status: 400 }
      );
    }
    const umur = umurBulanDariLahir(lahir);
    if (umur < 0 || umur < USIA_MINIMUM_BULAN) {
      return NextResponse.json(
        {
          ok: false,
          error: "Konsultasi dan Pemetaan Bakat Minat sebagai layanan tersendiri dibuka mulai usia empat tahun. Anak berusia di bawah empat tahun tidak didaftarkan pada layanan ini — minat dan cara belajarnya dibaca lewat Profil Cara Belajar pada laporan program kelas yang ia ikuti.",
        },
        { status: 400 }
      );
    }
    const scope = branchScope(denied.user);
    const branchId = body.branch_id ? String(body.branch_id) : scope?.[0] || null;
    if (scope && branchId && !scope.includes(branchId)) {
      return NextResponse.json({ ok: false, error: "Cabang di luar cakupan Anda." }, { status: 403 });
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO konsultasi
         (branch_id, child_id, child_name, child_birth_date, parent_name, wa_number, email, biaya, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        branchId,
        body.child_id ? String(body.child_id) : null,
        childName, lahir, parentName, wa,
        body.email ? String(body.email) : null,
        body.biaya !== undefined && body.biaya !== "" ? Number(body.biaya) : null,
        denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "konsultasi.create", entityTable: "konsultasi", entityId: rows[0].id, branchId,
      detail: { anak: childName, umur_bulan: umur },
    });
    return NextResponse.json({ ok: true, id: rows[0].id, umur_bulan: umur });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mendaftarkan klien konsultasi.") }, { status: 500 });
  }
}
