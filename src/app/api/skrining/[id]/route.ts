import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { susunDrafLaporan, type BarisHasil, type BarisIndikasi, type PetaPerkembangan } from "@/lib/skrining";

export const dynamic = "force-dynamic";

type SkrRow = Record<string, unknown> & {
  id: string; branch_id: string | null; status: string;
  persetujuan_ortu_at: string | null; tahap: Record<string, unknown>;
};

const adalahPemilik = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder"].includes(r));

async function ambil(id: string): Promise<SkrRow | null> {
  const rows = await query<SkrRow>("SELECT * FROM skrining WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const skr = await ambil(params.id);
    if (!skr) return NextResponse.json({ ok: false, error: "Pemeriksaan tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && skr.branch_id && !scope.includes(skr.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const laporan = await query("SELECT * FROM laporan_skrining WHERE skrining_id = $1", [params.id]);
    return NextResponse.json({ ok: true, skrining: skr, laporan: laporan[0] || null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const skr = await ambil(params.id);
    if (!skr) return NextResponse.json({ ok: false, error: "Pemeriksaan tidak ditemukan." }, { status: 404 });
    const scope = branchScope(denied.user);
    if (scope && skr.branch_id && !scope.includes(skr.branch_id)) {
      return NextResponse.json({ ok: false, error: "Di luar cakupan cabang Anda." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const tahap = (skr.tahap || {}) as Record<string, unknown>;

    // --- Simpan isian tahap (urutan terkunci: tahap n butuh tahap n−1) ---
    if (body.aksi === "tahap") {
      const n = Number(body.n);
      if (![1, 2, 3, 4].includes(n)) {
        return NextResponse.json({ ok: false, error: "Tahap tidak dikenal." }, { status: 400 });
      }
      if (skr.status === "selesai") {
        return NextResponse.json({ ok: false, error: "Pemeriksaan sudah selesai — isian tahap terkunci." }, { status: 409 });
      }
      if (n > 1 && !tahap[`tahap${n - 1}`]) {
        return NextResponse.json(
          { ok: false, error: `Tahap ${n} belum dapat dibuka: simpan dulu isian Tahap ${n - 1}. Urutan Tahapan Skrining tidak dapat dilompati.` },
          { status: 400 }
        );
      }
      const data = (body.data || {}) as Record<string, unknown>;
      const baru = { ...tahap, [`tahap${n}`]: { ...data, disimpan_at: new Date().toISOString() } };
      if (n === 1 && data.persetujuan_ortu) {
        await query(
          `UPDATE skrining SET tahap = $2::jsonb, persetujuan_ortu_at = COALESCE(persetujuan_ortu_at, now()),
             persetujuan_ortu_nama = COALESCE(persetujuan_ortu_nama, $3), updated_at = now() WHERE id = $1`,
          [params.id, JSON.stringify(baru), data.persetujuan_nama ? String(data.persetujuan_nama) : null]
        );
      } else {
        await query("UPDATE skrining SET tahap = $2::jsonb, updated_at = now() WHERE id = $1", [
          params.id, JSON.stringify(baru),
        ]);
      }
      return NextResponse.json({ ok: true, tahap: n });
    }

    // --- Gerbang status: Pendaftaran → Skrining Berjalan ---
    if (body.aksi === "mulai") {
      if (skr.status !== "pendaftaran") {
        return NextResponse.json({ ok: false, error: `Status saat ini "${skr.status}".` }, { status: 409 });
      }
      const kurang: string[] = [];
      if (!skr.persetujuan_ortu_at) kurang.push("catatan persetujuan tertulis orang tua");
      if (!tahap.tahap1) kurang.push("isian Tahap 1 (Penerimaan & Wawancara Awal)");
      if (kurang.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Skrining belum dapat berjalan. Syarat belum terpenuhi: ${kurang.join("; ")}.` },
          { status: 400 }
        );
      }
      await query("UPDATE skrining SET status = 'berjalan', updated_at = now() WHERE id = $1", [params.id]);
      await catatAudit(denied.user, {
        action: "skrining.mulai", entityTable: "skrining", entityId: params.id, branchId: skr.branch_id, detail: {},
      });
      return NextResponse.json({ ok: true, status: "berjalan" });
    }

    // --- Susun draf Laporan Hasil Skrining dari isian tahap ---
    if (body.aksi === "susun_draf") {
      const rows3 = ((tahap.tahap3 as { rows?: BarisHasil[] } | undefined)?.rows || []) as BarisHasil[];
      if (rows3.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Draf hanya lahir dari fakta yang diisikan: isian Tahap 3 (baris domain) masih kosong." },
          { status: 400 }
        );
      }
      const rows4 = ((tahap.tahap4 as { rows?: BarisIndikasi[] } | undefined)?.rows || []) as BarisIndikasi[];
      const draf = susunDrafLaporan({ tahap3Rows: rows3, tahap4Rows: rows4 });
      const ada = await query<{ id: string; status: string }>(
        "SELECT id, status FROM laporan_skrining WHERE skrining_id = $1", [params.id]
      );
      if (ada.length > 0 && ada[0].status === "final") {
        return NextResponse.json({ ok: false, error: "Laporan sudah final — draf tidak dapat disusun ulang." }, { status: 409 });
      }
      if (ada.length > 0) {
        await query(
          "UPDATE laporan_skrining SET tabel_hasil = $2::jsonb, indikasi = $3::jsonb, updated_at = now() WHERE skrining_id = $1",
          [params.id, JSON.stringify(draf.tabel_hasil), JSON.stringify(draf.indikasi)]
        );
      } else {
        await query(
          "INSERT INTO laporan_skrining (skrining_id, tabel_hasil, indikasi) VALUES ($1, $2::jsonb, $3::jsonb)",
          [params.id, JSON.stringify(draf.tabel_hasil), JSON.stringify(draf.indikasi)]
        );
      }
      return NextResponse.json({ ok: true, aksi: "susun_draf" });
    }

    // --- Simpan suntingan laporan (draf) — gabung dengan isi tersimpan ---
    if (body.aksi === "simpan_laporan") {
      const lap = await query<Record<string, unknown> & { id: string; status: string }>(
        "SELECT * FROM laporan_skrining WHERE skrining_id = $1", [params.id]
      );
      if (lap.length === 0) {
        return NextResponse.json({ ok: false, error: "Susun dulu draf laporan dari isian tahap." }, { status: 400 });
      }
      if (lap[0].status === "final") {
        return NextResponse.json({ ok: false, error: "Laporan sudah final dan terkunci." }, { status: 409 });
      }
      const lama = lap[0];
      const ambil = (kunci: string) =>
        body[kunci] !== undefined ? (body[kunci] ? String(body[kunci]) : null) : (lama[kunci] as string | null);
      await query(
        `UPDATE laporan_skrining SET
           tabel_hasil = $2::jsonb, ringkasan = $3, peta = $4::jsonb, kesimpulan = $5,
           rekomendasi = $6, rekomendasi_pilihan = $7, rekomendasi_alasan = $8,
           rekomendasi_bank = $9, updated_at = now()
         WHERE skrining_id = $1`,
        [
          params.id,
          JSON.stringify(body.tabel_hasil !== undefined ? body.tabel_hasil : lama.tabel_hasil),
          ambil("ringkasan"),
          JSON.stringify(body.peta !== undefined ? body.peta : lama.peta),
          ambil("kesimpulan"),
          ambil("rekomendasi"),
          ambil("rekomendasi_pilihan"),
          ambil("rekomendasi_alasan"),
          ambil("rekomendasi_bank"),
        ]
      );
      return NextResponse.json({ ok: true, aksi: "simpan_laporan" });
    }

    // --- Finalkan laporan (persetujuan pemilik; Peta wajib lengkap berbukti) ---
    if (body.aksi === "finalkan") {
      if (!adalahPemilik(denied.user)) {
        return NextResponse.json(
          { ok: false, error: "Draf wajib ditinjau dan disetujui pemilik sebelum menjadi Laporan Hasil Skrining final." },
          { status: 403 }
        );
      }
      const lap = await query<{ id: string; status: string; peta: PetaPerkembangan | null; ringkasan: string | null; kesimpulan: string | null }>(
        "SELECT id, status, peta, ringkasan, kesimpulan FROM laporan_skrining WHERE skrining_id = $1", [params.id]
      );
      if (lap.length === 0) return NextResponse.json({ ok: false, error: "Laporan belum disusun." }, { status: 400 });
      if (lap[0].status === "final") return NextResponse.json({ ok: true, status: "final" });
      const kurang: string[] = [];
      const peta = lap[0].peta;
      for (const [kunci, label] of [["kekuatan", "Kekuatan yang Menonjol"], ["berkembang", "Kemampuan yang Sedang Berkembang"], ["dukungan", "Area yang Memerlukan Dukungan"]] as const) {
        const b = peta?.[kunci];
        if (!b?.teks?.trim()) kurang.push(`bacaan ${label}`);
        else if (!b?.bukti?.trim()) kurang.push(`bukti teramati untuk ${label}`);
      }
      if (!lap[0].ringkasan?.trim()) kurang.push("ringkasan gambaran anak");
      if (!lap[0].kesimpulan?.trim()) kurang.push("kesimpulan bahasa pemetaan");
      if (kurang.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Laporan belum dapat difinalkan. Belum lengkap: ${kurang.join("; ")}. Setiap bacaan Peta Perkembangan Anak wajib disertai bukti indikator/tugas yang benar-benar teramati.` },
          { status: 400 }
        );
      }
      await query(
        "UPDATE laporan_skrining SET status = 'final', disetujui_oleh = $2, disetujui_at = now(), updated_at = now() WHERE skrining_id = $1",
        [params.id, denied.user.id]
      );
      await catatAudit(denied.user, {
        action: "skrining.laporan.final", entityTable: "laporan_skrining", entityId: lap[0].id, branchId: skr.branch_id, detail: {},
      });
      return NextResponse.json({ ok: true, status: "final" });
    }

    // --- Sesi penjelasan hasil kepada orang tua ---
    if (body.aksi === "penjelasan") {
      const lap = await query<{ id: string; status: string }>(
        "SELECT id, status FROM laporan_skrining WHERE skrining_id = $1", [params.id]
      );
      if (lap.length === 0 || lap[0].status !== "final") {
        return NextResponse.json({ ok: false, error: "Sesi penjelasan dicatat sesudah laporan final." }, { status: 400 });
      }
      const tanggal = String(body.tanggal || "");
      const oleh = String(body.oleh || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || oleh.length < 2) {
        return NextResponse.json({ ok: false, error: "Tanggal sesi dan nama pemberi penjelasan wajib diisi." }, { status: 400 });
      }
      await query(
        "UPDATE laporan_skrining SET penjelasan_tanggal = $2, penjelasan_oleh = $3, updated_at = now() WHERE skrining_id = $1",
        [params.id, tanggal, oleh]
      );
      return NextResponse.json({ ok: true, aksi: "penjelasan" });
    }

    // --- Catat pengiriman laporan sebagai berkas ke orang tua ---
    if (body.aksi === "kirim_laporan") {
      const saluran = String(body.saluran || "");
      if (!["whatsapp", "email"].includes(saluran)) {
        return NextResponse.json({ ok: false, error: "Saluran kirim tidak dikenal." }, { status: 400 });
      }
      const lap = await query<{ id: string; status: string }>(
        "SELECT id, status FROM laporan_skrining WHERE skrining_id = $1", [params.id]
      );
      if (lap.length === 0 || lap[0].status !== "final") {
        return NextResponse.json({ ok: false, error: "Hanya laporan final yang dapat dikirim." }, { status: 400 });
      }
      await query(
        "UPDATE laporan_skrining SET saluran = $2, dikirim_at = now(), dikirim_oleh = $3, updated_at = now() WHERE skrining_id = $1",
        [params.id, saluran, denied.user.id]
      );
      return NextResponse.json({ ok: true, aksi: "kirim_laporan" });
    }

    // --- Selesaikan pemeriksaan ---
    if (body.aksi === "selesaikan") {
      const lap = await query<{ status: string; penjelasan_tanggal: string | null; penjelasan_oleh: string | null }>(
        "SELECT status, penjelasan_tanggal::text AS penjelasan_tanggal, penjelasan_oleh FROM laporan_skrining WHERE skrining_id = $1",
        [params.id]
      );
      if (lap.length === 0 || lap[0].status !== "final") {
        return NextResponse.json({ ok: false, error: "Pemeriksaan selesai hanya sesudah Laporan Hasil Skrining final." }, { status: 400 });
      }
      if (!lap[0].penjelasan_tanggal || !lap[0].penjelasan_oleh) {
        return NextResponse.json(
          { ok: false, error: "Setiap Laporan Hasil Skrining ditutup sesi penjelasan hasil — catat dulu tanggal dan pemberi penjelasannya." },
          { status: 400 }
        );
      }
      await query("UPDATE skrining SET status = 'selesai', updated_at = now() WHERE id = $1", [params.id]);
      return NextResponse.json({ ok: true, status: "selesai" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui pemeriksaan skrining.") }, { status: 500 });
  }
}
