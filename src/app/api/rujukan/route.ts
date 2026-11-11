import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Daftar Berkas Rujukan.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const rows = await query(
      `SELECT br.*, c.full_name AS nama_anak_terhubung
         FROM berkas_rujukan br
         LEFT JOIN children c ON c.id = br.child_id
        WHERE ($1::uuid[] IS NULL OR br.branch_id = ANY($1::uuid[]) OR br.branch_id IS NULL)
        ORDER BY br.created_at DESC
        LIMIT 300`,
      [scope]
    );
    return NextResponse.json({ ok: true, rujukan: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Bangkitkan Berkas Rujukan dari profil anak begitu pemicu tercapai.
// Kolom tujuan rujukan SELALU KOSONG pada draf — server menolak tujuan yang
// dikirim pada pembuatan; tujuan diketik/dipilih saat berkas diterbitkan.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.tujuan && String(body.tujuan).trim() !== "") {
      return NextResponse.json(
        { ok: false, error: "Kolom tujuan rujukan selalu kosong pada draf — tujuan diketik atau dipilih saat berkas diterbitkan, sesuai kesepakatan bersama orang tua." },
        { status: 400 }
      );
    }
    const childName = String(body.child_name || "").trim();
    const pemicu = String(body.pemicu || "").trim();
    if (childName.length < 2 || pemicu.length < 5) {
      return NextResponse.json(
        { ok: false, error: "Nama anak dan catatan pemicu rujukan wajib diisi." },
        { status: 400 }
      );
    }
    const scope = branchScope(denied.user);
    const branchId = body.branch_id ? String(body.branch_id) : scope?.[0] || null;
    const rows = await query<{ id: string }>(
      `INSERT INTO berkas_rujukan
         (branch_id, child_id, child_name, skrining_id, laporan_skrining_id, pemicu, laporan_observasi, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        branchId,
        body.child_id ? String(body.child_id) : null,
        childName,
        body.skrining_id ? String(body.skrining_id) : null,
        body.laporan_skrining_id ? String(body.laporan_skrining_id) : null,
        pemicu,
        body.laporan_observasi ? String(body.laporan_observasi) : null,
        denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "rujukan.create", entityTable: "berkas_rujukan", entityId: rows[0].id, branchId,
      detail: { anak: childName },
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat berkas rujukan.") }, { status: 500 });
  }
}
