import { NextResponse } from "next/server";
import { emailRaporTerbitWali } from "@/lib/beritahu-wali";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { KOLOM_NARASI, agregatRapor } from "@/lib/rapor";

export const dynamic = "force-dynamic";

async function ambil(id: string) {
  const rows = await query<Record<string, unknown> & { child_id: string; cycle_start: string; cycle_end: string }>(
    `SELECT cr.*, c.full_name AS child_name, lc.theme AS cycle_theme,
            lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
            s.full_name AS teacher_name, s.photo_url AS teacher_photo, s.signature_url AS teacher_ttd, b.name AS branch_name,
            pu.full_name AS diperiksa_oleh_nama, su.full_name AS disetujui_oleh_nama,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN learning_cycles lc ON lc.id = cr.cycle_id
       JOIN branches b ON b.id = cr.branch_id
       LEFT JOIN staff s ON s.id = cr.created_by
       LEFT JOIN users pu ON pu.id = cr.diperiksa_oleh
       LEFT JOIN users su ON su.id = cr.disetujui_oleh
      WHERE cr.id = $1::uuid`,
    [id]
  );
  return rows[0] || null;
}

// Alur terbit rapor empat tahap terkunci: Draf Guru → Diperiksa Manager →
// Disetujui Founder → Terbit. Persetujuan akhir adalah hak founder.
type Pengguna = { id: string; roles: string[]; role: string };
const peranDari = (u: Pengguna) => [...u.roles, u.role];
const adalahManager = (u: Pengguna) =>
  peranDari(u).some((r) => ["branch_manager", "manager", "owner", "super_admin", "founder"].includes(r));
const adalahFounder = (u: Pengguna) =>
  peranDari(u).some((r) => ["owner", "super_admin", "founder"].includes(r));

// Detail rapor + agregasi presensi, tumbuh kembang, dan dokumentasi siklusnya.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const report = await ambil(params.id);
    if (!report) return NextResponse.json({ ok: false, error: "Rapor tidak ditemukan." }, { status: 404 });
    const [agregat, fotoSendiri] = await Promise.all([
      agregatRapor(report.child_id, report.cycle_start, report.cycle_end, params.id),
      query<{ photo_url: string; caption: string | null }>(
        "SELECT photo_url, caption FROM cycle_report_photos WHERE report_id = $1 ORDER BY sort_order, created_at",
        [params.id]
      ),
    ]);
    const status = String(report.status);
    const aksi_tersedia = {
      periksa: status === "draft" && adalahManager(denied.user),
      setujui: status === "diperiksa" && adalahFounder(denied.user),
      terbit: status === "disetujui" && adalahFounder(denied.user),
      kembalikan: (status === "diperiksa" || status === "disetujui") && (adalahManager(denied.user) || adalahFounder(denied.user)),
      tarik: status === "published" && adalahFounder(denied.user),
    };
    return NextResponse.json({ ok: true, report, agregat, photos: fotoSendiri, aksi_tersedia });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

type PatchBody = Record<string, unknown> & {
  publish?: boolean;
  unpublish?: boolean;
  aksi?: string;
  photos?: Array<{ photo_url: string; caption?: string }>;
};

// Simpan narasi (draft) atau terbitkan/kembalikan rapor.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as PatchBody;
    const sekarang = await query<{ status: string; branch_id: string }>(
      "SELECT status, branch_id FROM cycle_reports WHERE id = $1",
      [params.id]
    );
    if (sekarang.length === 0) {
      return NextResponse.json({ ok: false, error: "Rapor tidak ditemukan." }, { status: 404 });
    }
    const { status, branch_id } = sekarang[0];

    // --- Mesin tahap terbit (4 tahap terkunci) ---
    const tahapSalah = (perlu: string) =>
      NextResponse.json(
        { ok: false, error: `Tahap rapor saat ini "${status}" — aksi ini memerlukan tahap "${perlu}".` },
        { status: 409 }
      );
    const terbit = async () => {
      await query("UPDATE cycle_reports SET status = 'published', published_at = now(), updated_at = now() WHERE id = $1", [params.id]);
      await catatAudit(denied.user, {
        action: "rapor.diterbitkan", entityTable: "cycle_reports", entityId: params.id, branchId: branch_id, detail: {},
      });
      void emailRaporTerbitWali(params.id).catch((e) => console.error("[EMAIL-TERBIT]", (e as Error)?.message));
      return NextResponse.json({ ok: true, status: "published" });
    };

    if (body.aksi === "periksa") {
      if (!adalahManager(denied.user)) {
        return NextResponse.json({ ok: false, error: "Tahap Diperiksa Manager hanya oleh manager atau founder." }, { status: 403 });
      }
      if (status !== "draft") return tahapSalah("draft");
      await query(
        "UPDATE cycle_reports SET status = 'diperiksa', diperiksa_oleh = $2, diperiksa_at = now(), updated_at = now() WHERE id = $1",
        [params.id, denied.user.id]
      );
      await catatAudit(denied.user, { action: "rapor.diperiksa", entityTable: "cycle_reports", entityId: params.id, branchId: branch_id, detail: {} });
      return NextResponse.json({ ok: true, status: "diperiksa" });
    }

    if (body.aksi === "setujui") {
      if (!adalahFounder(denied.user)) {
        return NextResponse.json({ ok: false, error: "Persetujuan akhir rapor periodik adalah hak founder." }, { status: 403 });
      }
      if (status !== "diperiksa") return tahapSalah("diperiksa");
      await query(
        "UPDATE cycle_reports SET status = 'disetujui', disetujui_oleh = $2, disetujui_at = now(), updated_at = now() WHERE id = $1",
        [params.id, denied.user.id]
      );
      await catatAudit(denied.user, { action: "rapor.disetujui", entityTable: "cycle_reports", entityId: params.id, branchId: branch_id, detail: {} });
      return NextResponse.json({ ok: true, status: "disetujui" });
    }

    if (body.aksi === "terbit") {
      if (!adalahFounder(denied.user)) {
        return NextResponse.json({ ok: false, error: "Penerbitan rapor adalah hak founder sesudah persetujuan." }, { status: 403 });
      }
      if (status === "published") return NextResponse.json({ ok: true, status });
      if (status !== "disetujui") return tahapSalah("disetujui");
      return terbit();
    }

    if (body.aksi === "kembalikan" || body.aksi === "tarik") {
      const dariTerbit = status === "published";
      if (!adalahFounder(denied.user) && !(body.aksi === "kembalikan" && adalahManager(denied.user))) {
        return NextResponse.json({ ok: false, error: "Pengembalian rapor ke draf hanya oleh manager atau founder." }, { status: 403 });
      }
      if (body.aksi === "kembalikan" && !["diperiksa", "disetujui"].includes(status)) return tahapSalah("diperiksa/disetujui");
      if (body.aksi === "tarik" && !dariTerbit) return tahapSalah("published");
      await query(
        `UPDATE cycle_reports
            SET status = 'draft', published_at = NULL,
                diperiksa_oleh = NULL, diperiksa_at = NULL,
                disetujui_oleh = NULL, disetujui_at = NULL, updated_at = now()
          WHERE id = $1`,
        [params.id]
      );
      await catatAudit(denied.user, {
        action: body.aksi === "tarik" ? "rapor.ditarik" : "rapor.dikembalikan",
        entityTable: "cycle_reports", entityId: params.id, branchId: branch_id, detail: {},
      });
      return NextResponse.json({ ok: true, status: "draft" });
    }

    if (body.publish) {
      // Jalan lama: hanya sah sebagai penerbitan dari tahap disetujui.
      if (status === "published") return NextResponse.json({ ok: true, status });
      if (status !== "disetujui") {
        return NextResponse.json(
          { ok: false, error: "Rapor melewati alur 4 tahap: Draf Guru → Diperiksa Manager → Disetujui Founder → Terbit. Selesaikan tahapnya dari halaman rapor." },
          { status: 409 }
        );
      }
      if (!adalahFounder(denied.user)) {
        return NextResponse.json({ ok: false, error: "Penerbitan rapor adalah hak founder." }, { status: 403 });
      }
      return terbit();
    }

    if (body.unpublish) {
      if (!adalahFounder(denied.user) && !adalahManager(denied.user)) {
        return NextResponse.json({ ok: false, error: "Anda tidak berhak menarik rapor terbit." }, { status: 403 });
      }
      await query(
        `UPDATE cycle_reports
            SET status = 'draft', published_at = NULL,
                diperiksa_oleh = NULL, diperiksa_at = NULL,
                disetujui_oleh = NULL, disetujui_at = NULL, updated_at = now()
          WHERE id = $1`,
        [params.id]
      );
      await catatAudit(denied.user, {
        action: "rapor.ditarik", entityTable: "cycle_reports", entityId: params.id, branchId: branch_id, detail: {},
      });
      return NextResponse.json({ ok: true, status: "draft" });
    }

    if (status !== "draft") {
      return NextResponse.json(
        { ok: false, error: "Narasi hanya bisa diubah pada tahap Draf Guru. Kembalikan dulu rapor ke draf." },
        { status: 409 }
      );
    }
    const values: unknown[] = [params.id];
    const sets: string[] = [];
    for (const kolom of KOLOM_NARASI) {
      if (kolom in body) {
        values.push(typeof body[kolom] === "string" && body[kolom] !== "" ? body[kolom] : null);
        sets.push(`${kolom} = $${values.length}`);
      }
    }
    if (sets.length > 0) {
      await query(`UPDATE cycle_reports SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
    }
    if ("inggris_tahap" in body) {
      const t = Number(body.inggris_tahap);
      await query("UPDATE cycle_reports SET inggris_tahap = $2, updated_at = now() WHERE id = $1", [
        params.id,
        [1, 2, 3].includes(t) ? t : null,
      ]);
    }
    // Foto dokumentasi unggahan langsung: kiriman photos menggantikan seluruh
    // daftar (pola yang sama dengan foto galeri laporan harian).
    if (Array.isArray(body.photos)) {
      await query("DELETE FROM cycle_report_photos WHERE report_id = $1", [params.id]);
      let urut = 0;
      for (const p of body.photos) {
        if (!p.photo_url) continue;
        urut += 1;
        await query(
          "INSERT INTO cycle_report_photos (report_id, photo_url, caption, sort_order) VALUES ($1,$2,$3,$4)",
          [params.id, p.photo_url, p.caption || null, urut]
        );
      }
    }
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
