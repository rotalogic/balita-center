import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Arsip surat berstatus + pustaka template.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const [surat, templates] = await Promise.all([
      query(
        `SELECT * FROM surat
          WHERE ($1::uuid[] IS NULL OR branch_id = ANY($1::uuid[]) OR branch_id IS NULL)
          ORDER BY created_at DESC LIMIT 300`,
        [scope]
      ),
      query("SELECT * FROM surat_template WHERE aktif ORDER BY nama"),
    ]);
    return NextResponse.json({ ok: true, surat, templates });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Buat surat dari template: variabel {{kunci}} pada isi template diisi dari
// isian pengguna. Surat lahir sebagai draf TANPA nomor — nomor otomatis
// (urut/kode/bulan Romawi/tahun) baru diberikan saat diterbitkan.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tpl = await query<{ id: string; kode_jenis: string; isi: string; perihal_default: string | null }>(
      "SELECT id, kode_jenis, isi, perihal_default FROM surat_template WHERE id = $1 AND aktif",
      [String(body.template_id || "")]
    );
    if (tpl.length === 0) return NextResponse.json({ ok: false, error: "Template tidak ditemukan." }, { status: 404 });
    const variabel = (body.variabel || {}) as Record<string, string>;
    let isi = tpl[0].isi;
    let perihal = String(body.perihal || tpl[0].perihal_default || "Surat");
    for (const [k, v] of Object.entries(variabel)) {
      isi = isi.split(`{{${k}}}`).join(String(v));
      perihal = perihal.split(`{{${k}}}`).join(String(v));
    }
    const belum = isi.match(/\{\{[^}]+\}\}/g);
    const scope = branchScope(denied.user);
    const rows = await query<{ id: string }>(
      `INSERT INTO surat (branch_id, template_id, kode_jenis, perihal, tujuan, isi, variabel, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : scope?.[0] || null,
        tpl[0].id, tpl[0].kode_jenis, perihal,
        body.tujuan ? String(body.tujuan) : null,
        isi, JSON.stringify(variabel), denied.user.id,
      ]
    );
    await catatAudit(denied.user, {
      action: "surat.create", entityTable: "surat", entityId: rows[0].id, detail: { perihal },
    });
    return NextResponse.json({
      ok: true, id: rows[0].id,
      variabel_belum_terisi: belum ? [...new Set(belum)] : [],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat surat.") }, { status: 500 });
  }
}
