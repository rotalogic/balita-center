import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type KonRow = Record<string, unknown> & {
  id: string; branch_id: string | null; status: string; laporan_status: string;
  langkah: Record<string, unknown>; sesi_tanggal: string | null;
};

const adalahPendiri = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder"].includes(r));

async function ambil(id: string): Promise<KonRow | null> {
  const rows = await query<KonRow>("SELECT * FROM konsultasi WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const kon = await ambil(params.id);
    if (!kon) return NextResponse.json({ ok: false, error: "Berkas konsultasi tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && kon.branch_id && !scope.includes(kon.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, konsultasi: kon });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const kon = await ambil(params.id);
    if (!kon) return NextResponse.json({ ok: false, error: "Berkas konsultasi tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && kon.branch_id && !scope.includes(kon.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const langkah = (kon.langkah || {}) as Record<string, unknown>;

    // Simpan isian langkah 1 atau 2 (urutan: langkah 2 sesudah langkah 1).
    if (body.aksi === "langkah") {
      const n = Number(body.n);
      if (![1, 2].includes(n)) {
        return NextResponse.json({ ok: false, error: "Langkah tidak dikenal." }, { status: 400 });
      }
      if (kon.status === "selesai") {
        return NextResponse.json({ ok: false, error: "Konsultasi sudah selesai — isian terkunci." }, { status: 409 });
      }
      if (n === 2 && !langkah.langkah1) {
        return NextResponse.json(
          { ok: false, error: "Simpan dulu Langkah 1 (Pendaftaran & Wawancara Awal) sebelum pemetaan." },
          { status: 400 }
        );
      }
      const data = (body.data || {}) as Record<string, unknown>;
      const baru = { ...langkah, [`langkah${n}`]: { ...data, disimpan_at: new Date().toISOString() } };
      await query(
        `UPDATE konsultasi SET langkah = $2::jsonb,
           tanda_rujukan = COALESCE($3, tanda_rujukan),
           status = CASE WHEN status = 'pendaftaran' THEN 'pemetaan' ELSE status END,
           updated_at = now() WHERE id = $1`,
        [params.id, JSON.stringify(baru), body.tanda_rujukan ? String(body.tanda_rujukan) : null]
      );
      return NextResponse.json({ ok: true, langkah: n });
    }

    // Langkah 3 — sesi konsultasi penjelasan hasil bersama pendiri.
    if (body.aksi === "sesi") {
      if (!langkah.langkah2) {
        return NextResponse.json(
          { ok: false, error: "Sesi penjelasan hasil berjalan sesudah pemetaan (Langkah 2) tersimpan." },
          { status: 400 }
        );
      }
      const tanggal = String(body.tanggal || "");
      const oleh = String(body.oleh || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || oleh.length < 2) {
        return NextResponse.json({ ok: false, error: "Tanggal sesi dan nama pendiri penyampai hasil wajib diisi." }, { status: 400 });
      }
      await query(
        "UPDATE konsultasi SET sesi_tanggal = $2, sesi_oleh = $3, updated_at = now() WHERE id = $1",
        [params.id, tanggal, oleh]
      );
      return NextResponse.json({ ok: true, aksi: "sesi" });
    }

    // Langkah 4 — simpan keluaran sebagai draf Laporan Konsultasi.
    if (body.aksi === "simpan_laporan") {
      if (kon.laporan_status === "final") {
        return NextResponse.json({ ok: false, error: "Laporan Konsultasi sudah final dan terkunci." }, { status: 409 });
      }
      if (!langkah.langkah2) {
        return NextResponse.json({ ok: false, error: "Keluaran lahir dari pemetaan — simpan dulu Langkah 2." }, { status: 400 });
      }
      const ambil = (kunci: string) =>
        body[kunci] !== undefined ? (body[kunci] ? String(body[kunci]) : null) : (kon[kunci] as string | null);
      await query(
        `UPDATE konsultasi SET kekuatan_menonjol = $2, bidang_minat = $3, lensa = $4::jsonb,
           kecenderungan_arah = $5, rekomendasi = $6, laporan_status = 'draft', updated_at = now()
         WHERE id = $1`,
        [
          params.id, ambil("kekuatan_menonjol"), ambil("bidang_minat"),
          JSON.stringify(body.lensa !== undefined ? body.lensa : kon.lensa),
          ambil("kecenderungan_arah"), ambil("rekomendasi"),
        ]
      );
      return NextResponse.json({ ok: true, laporan_status: "draft" });
    }

    // Finalkan — keluaran ditinjau dan disetujui pendiri; sesi penjelasan
    // hasil (Langkah 3) wajib sudah tercatat.
    if (body.aksi === "finalkan") {
      if (!adalahPendiri(denied.user)) {
        return NextResponse.json(
          { ok: false, error: "Laporan Konsultasi difinalkan oleh pendiri yang menerima layanan ini langsung." },
          { status: 403 }
        );
      }
      const kurang: string[] = [];
      if (!kon.sesi_tanggal) kurang.push("sesi konsultasi penjelasan hasil (Langkah 3) belum tercatat");
      if (!(kon.kekuatan_menonjol as string | null)?.trim()) kurang.push("kekuatan yang menonjol pada Peta Kekuatan dan Minat");
      if (!(kon.bidang_minat as string | null)?.trim()) kurang.push("bidang minat yang terbaca");
      if (!(kon.kecenderungan_arah as string | null)?.trim()) kurang.push("Kecenderungan Arah di dalam Rekomendasi Pengarahan");
      if (!(kon.rekomendasi as string | null)?.trim()) kurang.push("Rekomendasi Pengarahan");
      if (kurang.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Laporan Konsultasi belum dapat difinalkan. Belum lengkap: ${kurang.join("; ")}.` },
          { status: 400 }
        );
      }
      await query(
        `UPDATE konsultasi SET laporan_status = 'final', disetujui_oleh = $2, disetujui_at = now(),
           status = 'selesai', updated_at = now() WHERE id = $1`,
        [params.id, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "konsultasi.laporan.final", entityTable: "konsultasi", entityId: params.id,
        branchId: kon.branch_id, detail: {},
      });
      return NextResponse.json({ ok: true, laporan_status: "final" });
    }

    // Catat pengiriman Laporan Konsultasi ke keluarga.
    if (body.aksi === "kirim") {
      const saluran = String(body.saluran || "");
      if (!["whatsapp", "email"].includes(saluran)) {
        return NextResponse.json({ ok: false, error: "Saluran kirim tidak dikenal." }, { status: 400 });
      }
      if (kon.laporan_status !== "final") {
        return NextResponse.json({ ok: false, error: "Hanya Laporan Konsultasi final yang dapat dikirim." }, { status: 400 });
      }
      await query(
        "UPDATE konsultasi SET saluran = $2, dikirim_at = now(), dikirim_oleh = $3, updated_at = now() WHERE id = $1",
        [params.id, saluran, denied.user.id]
      );
      return NextResponse.json({ ok: true, aksi: "kirim" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui berkas konsultasi.") }, { status: 500 });
  }
}
