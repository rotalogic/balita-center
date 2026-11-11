import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { formatNomorSurat } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

const adalahPimpinan = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder", "branch_manager", "manager"].includes(r));

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query("SELECT * FROM surat WHERE id = $1", [params.id]);
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Surat tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, surat: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const rows = await query<{ id: string; status: string; kode_jenis: string; perihal: string; tujuan: string | null; isi: string }>(
      "SELECT id, status, kode_jenis, perihal, tujuan, isi FROM surat WHERE id = $1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Surat tidak ditemukan." }, { status: 404 });
    const surat = rows[0];
    const body = (await request.json()) as Record<string, unknown>;

    if (body.aksi === undefined) {
      if (surat.status !== "draft") {
        return NextResponse.json({ ok: false, error: "Surat yang sudah diterbitkan tidak dapat diubah." }, { status: 409 });
      }
      await query(
        "UPDATE surat SET perihal = $2, tujuan = $3, isi = $4, updated_at = now() WHERE id = $1",
        [
          params.id,
          body.perihal !== undefined ? String(body.perihal) : surat.perihal,
          body.tujuan !== undefined ? (body.tujuan ? String(body.tujuan) : null) : surat.tujuan,
          body.isi !== undefined ? String(body.isi) : surat.isi,
        ]
      );
      return NextResponse.json({ ok: true });
    }

    // Terbitkan: penomoran otomatis berformat urut/kode/bulan Romawi/tahun,
    // dihitung atomik per (tahun, kode jenis).
    if (body.aksi === "terbitkan") {
      if (!adalahPimpinan(denied.user)) {
        return NextResponse.json({ ok: false, error: "Penerbitan surat adalah wewenang founder/manager." }, { status: 403 });
      }
      if (surat.status !== "draft") {
        return NextResponse.json({ ok: false, error: `Surat berstatus "${surat.status}".` }, { status: 409 });
      }
      const kini = new Date();
      const tahun = kini.getFullYear();
      const counter = await query<{ terakhir: number }>(
        `INSERT INTO surat_counter (tahun, kode_jenis, terakhir) VALUES ($1,$2,1)
         ON CONFLICT (tahun, kode_jenis) DO UPDATE SET terakhir = surat_counter.terakhir + 1
         RETURNING terakhir`,
        [tahun, surat.kode_jenis]
      );
      const urut = counter[0].terakhir;
      const nomor = formatNomorSurat(urut, surat.kode_jenis, kini);
      await query(
        `UPDATE surat SET nomor = $2, urut = $3, status = 'terbit',
           diterbitkan_oleh = $4, diterbitkan_at = now(), updated_at = now() WHERE id = $1`,
        [params.id, nomor, urut, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "surat.terbit", entityTable: "surat", entityId: params.id, detail: { nomor },
      });
      return NextResponse.json({ ok: true, nomor });
    }

    if (body.aksi === "arsipkan") {
      if (surat.status !== "terbit") {
        return NextResponse.json({ ok: false, error: "Hanya surat terbit yang dapat diarsipkan." }, { status: 409 });
      }
      await query("UPDATE surat SET status = 'arsip', updated_at = now() WHERE id = $1", [params.id]);
      return NextResponse.json({ ok: true, status: "arsip" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui surat.") }, { status: 500 });
  }
}
