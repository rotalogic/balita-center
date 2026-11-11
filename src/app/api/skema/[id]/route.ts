import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const adalahFounder = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder"].includes(r));

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("finance.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rows = await query<{ id: string; status: string; nama: string }>(
      "SELECT id, status, nama FROM skema_biaya WHERE id = $1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Skema tidak ditemukan." }, { status: 404 });
    const skema = rows[0];

    // Hanya founder yang mengubah status Rancangan menjadi Final.
    if (body.aksi === "jadikan_final") {
      if (!adalahFounder(denied.user)) {
        return NextResponse.json(
          { ok: false, error: "Status skema hanya dapat diubah menjadi Final oleh founder." },
          { status: 403 }
        );
      }
      await query(
        "UPDATE skema_biaya SET status = 'final', difinalkan_oleh = $2, difinalkan_at = now(), updated_at = now() WHERE id = $1",
        [params.id, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "skema.final", entityTable: "skema_biaya", entityId: params.id, detail: { nama: skema.nama },
      });
      return NextResponse.json({ ok: true, status: "final" });
    }

    if (body.aksi === "tautkan_program") {
      const programId = String(body.program_id || "");
      if (!programId) return NextResponse.json({ ok: false, error: "Program wajib dipilih." }, { status: 400 });
      await query("UPDATE programs SET skema_id = $1 WHERE id = $2", [params.id, programId]);
      return NextResponse.json({ ok: true, aksi: "tautkan_program" });
    }

    if (body.aksi === "lepas_program") {
      const programId = String(body.program_id || "");
      await query("UPDATE programs SET skema_id = NULL WHERE id = $1 AND skema_id = $2", [programId, params.id]);
      return NextResponse.json({ ok: true, aksi: "lepas_program" });
    }

    // Sunting nama/komponen/keterangan — hanya selama Rancangan.
    if (skema.status === "final") {
      return NextResponse.json({ ok: false, error: "Skema Final terkunci dari penyuntingan." }, { status: 409 });
    }
    const lama = await query<{ nama: string; komponen: unknown; keterangan: string | null }>(
      "SELECT nama, komponen, keterangan FROM skema_biaya WHERE id = $1", [params.id]
    );
    await query(
      "UPDATE skema_biaya SET nama = $2, komponen = $3::jsonb, keterangan = $4, updated_at = now() WHERE id = $1",
      [
        params.id,
        body.nama !== undefined ? String(body.nama) : lama[0].nama,
        JSON.stringify(body.komponen !== undefined ? body.komponen : lama[0].komponen),
        body.keterangan !== undefined ? (body.keterangan ? String(body.keterangan) : null) : lama[0].keterangan,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui skema.") }, { status: 500 });
  }
}
