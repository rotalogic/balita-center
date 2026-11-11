import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RujRow = Record<string, unknown> & {
  id: string; branch_id: string | null; status: string; tujuan: string | null;
  laporan_observasi: string | null; laporan_skrining_id: string | null;
  persetujuan_ortu_tercatat: boolean;
};

const adalahFounder = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder"].includes(r));

async function ambil(id: string): Promise<RujRow | null> {
  const rows = await query<RujRow>("SELECT * FROM berkas_rujukan WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const br = await ambil(params.id);
    if (!br) return NextResponse.json({ ok: false, error: "Berkas rujukan tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && br.branch_id && !scope.includes(br.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const lampiran = br.laporan_skrining_id
      ? await query("SELECT * FROM laporan_skrining WHERE id = $1", [br.laporan_skrining_id])
      : [];
    // Laporan Hasil Skrining final milik anak yang sama dapat dipasang
    // langsung sebagai lampiran Laporan Observasi — tanpa menyalin isinya.
    const tersedia = await query(
      `SELECT l.id, l.status, s.child_name, s.jenis
         FROM laporan_skrining l
         JOIN skrining s ON s.id = l.skrining_id
        WHERE l.status = 'final'
          AND (($1::uuid IS NOT NULL AND s.child_id = $1) OR lower(s.child_name) = lower($2))
        ORDER BY l.created_at DESC
        LIMIT 10`,
      [br.child_id, br.child_name]
    );
    return NextResponse.json({
      ok: true, rujukan: br, lampiran_laporan: lampiran[0] || null, laporan_tersedia: tersedia,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const br = await ambil(params.id);
    if (!br) return NextResponse.json({ ok: false, error: "Berkas rujukan tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && br.branch_id && !scope.includes(br.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    // Suntingan draf: pemicu, laporan observasi, lampiran laporan skrining,
    // dan catatan persetujuan orang tua. Tujuan tidak dapat disentuh di draf.
    if (body.aksi === undefined) {
      if (br.status !== "draft") {
        return NextResponse.json({ ok: false, error: "Berkas yang sudah diterbitkan tidak dapat diubah." }, { status: 409 });
      }
      if (body.tujuan !== undefined && String(body.tujuan || "").trim() !== "") {
        return NextResponse.json(
          { ok: false, error: "Kolom tujuan selalu kosong pada draf — diisi saat berkas diterbitkan." },
          { status: 400 }
        );
      }
      const setuju = body.persetujuan_ortu_tercatat !== undefined
        ? Boolean(body.persetujuan_ortu_tercatat)
        : br.persetujuan_ortu_tercatat;
      await query(
        `UPDATE berkas_rujukan SET
           pemicu = COALESCE($2, pemicu),
           laporan_observasi = $3,
           laporan_skrining_id = $4,
           persetujuan_ortu_tercatat = $5,
           persetujuan_ortu_at = CASE WHEN $5 AND persetujuan_ortu_at IS NULL THEN now() ELSE persetujuan_ortu_at END,
           updated_at = now()
         WHERE id = $1`,
        [
          params.id,
          body.pemicu ? String(body.pemicu) : null,
          body.laporan_observasi !== undefined ? (body.laporan_observasi ? String(body.laporan_observasi) : null) : br.laporan_observasi,
          body.laporan_skrining_id !== undefined ? (body.laporan_skrining_id ? String(body.laporan_skrining_id) : null) : br.laporan_skrining_id,
          setuju,
        ]
      );
      return NextResponse.json({ ok: true });
    }

    // Terbitkan: persetujuan akhir founder; tujuan diisi sekarang; status
    // siap kirim hanya bila laporan observasi lengkap terlampir DAN
    // persetujuan tertulis orang tua tercatat.
    if (body.aksi === "terbitkan") {
      if (!adalahFounder(denied.user)) {
        return NextResponse.json(
          { ok: false, error: "Persetujuan akhir berkas rujukan adalah hak khusus founder." },
          { status: 403 }
        );
      }
      if (br.status !== "draft") {
        return NextResponse.json({ ok: false, error: `Berkas berstatus "${br.status}".` }, { status: 409 });
      }
      const tujuan = String(body.tujuan || "").trim();
      if (tujuan.length < 3) {
        return NextResponse.json(
          { ok: false, error: "Tujuan rujukan wajib diketik atau dipilih dari pilihan cepat saat berkas diterbitkan." },
          { status: 400 }
        );
      }
      const laporanLengkap = Boolean(br.laporan_skrining_id) || Boolean(br.laporan_observasi && br.laporan_observasi.trim().length >= 10);
      if (!laporanLengkap) {
        return NextResponse.json(
          { ok: false, error: "Status siap kirim mensyaratkan laporan observasi lengkap anak terlampir (lampirkan Laporan Hasil Skrining final atau isi laporan observasi)." },
          { status: 400 }
        );
      }
      if (!br.persetujuan_ortu_tercatat) {
        return NextResponse.json(
          { ok: false, error: "Status siap kirim mensyaratkan persetujuan tertulis orang tua tercatat." },
          { status: 400 }
        );
      }
      await query(
        `UPDATE berkas_rujukan SET tujuan = $2, status = 'siap_kirim',
           diterbitkan_oleh = $3, diterbitkan_at = now(), updated_at = now() WHERE id = $1`,
        [params.id, tujuan, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "rujukan.terbit", entityTable: "berkas_rujukan", entityId: params.id, branchId: br.branch_id,
        detail: { tujuan },
      });
      return NextResponse.json({ ok: true, status: "siap_kirim" });
    }

    if (body.aksi === "kirim") {
      if (br.status !== "siap_kirim") {
        return NextResponse.json({ ok: false, error: "Hanya berkas siap kirim yang dapat dicatat terkirim." }, { status: 409 });
      }
      const saluran = String(body.saluran || "");
      if (!["whatsapp", "email", "langsung"].includes(saluran)) {
        return NextResponse.json({ ok: false, error: "Saluran kirim tidak dikenal." }, { status: 400 });
      }
      await query(
        "UPDATE berkas_rujukan SET status = 'terkirim', saluran = $2, dikirim_at = now(), updated_at = now() WHERE id = $1",
        [params.id, saluran]
      );
      return NextResponse.json({ ok: true, status: "terkirim" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui berkas rujukan.") }, { status: 500 });
  }
}
