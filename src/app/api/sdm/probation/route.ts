import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { JUMLAH_GUGUS, TINGKAT_MINIMUM } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

const adalahPimpinan = (u: { roles: string[]; role: string }) =>
  [...u.roles, u.role].some((r) => ["owner", "super_admin", "founder", "branch_manager", "manager"].includes(r));

// Ketentuan Masa Magang dan Probation Guru: tiga bulan sejak hari pertama
// bekerja (Adaptasi & Pelatihan → Praktik Terbimbing → Penilaian Standar).
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const rows = await query(
      `SELECT p.*, s.full_name AS staff_name, s.position, s.branch_id
         FROM probation p JOIN staff s ON s.id = p.staff_id
        WHERE s.deleted_at IS NULL
        ORDER BY p.mulai DESC`
    );
    return NextResponse.json({ ok: true, probation: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.staff_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.mulai || ""))) {
      return NextResponse.json({ ok: false, error: "Staf dan tanggal hari pertama bekerja wajib diisi." }, { status: 400 });
    }
    const rows = await query<{ id: string }>(
      "INSERT INTO probation (staff_id, mulai) VALUES ($1,$2) RETURNING id",
      [String(body.staff_id), String(body.mulai)]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memulai masa probation.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rows = await query<Record<string, unknown> & { id: string; staff_id: string; status: string; perpanjangan_bulan: number | null; persetujuan: Record<string, string> }>(
      "SELECT * FROM probation WHERE id = $1", [String(body.id || "")]
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Catatan probation tidak ditemukan." }, { status: 404 });
    const prob = rows[0];

    // Persetujuan ketentuan oleh guru, manager, dan founder — tercatat
    // beserta waktunya.
    if (body.aksi === "setujui") {
      const peran = String(body.peran || "");
      if (!["guru", "manager", "founder"].includes(peran)) {
        return NextResponse.json({ ok: false, error: "Peran persetujuan tidak dikenal." }, { status: 400 });
      }
      if (peran !== "guru" && !adalahPimpinan(denied.user)) {
        return NextResponse.json({ ok: false, error: "Persetujuan manager/founder dicatat oleh pimpinan." }, { status: 403 });
      }
      const baru = { ...(prob.persetujuan || {}), [peran]: new Date().toISOString() };
      await query("UPDATE probation SET persetujuan = $2::jsonb, updated_at = now() WHERE id = $1", [prob.id, JSON.stringify(baru)]);
      return NextResponse.json({ ok: true, persetujuan: baru });
    }

    // Pelanggaran berat (keselamatan anak, kerahasiaan data, kekerasan)
    // menggugurkan masa probation seketika.
    if (body.aksi === "pelanggaran") {
      if (!adalahPimpinan(denied.user)) {
        return NextResponse.json({ ok: false, error: "Pencatatan pelanggaran berat adalah wewenang pimpinan." }, { status: 403 });
      }
      const ket = String(body.keterangan || "").trim();
      if (ket.length < 5) return NextResponse.json({ ok: false, error: "Keterangan pelanggaran wajib diisi." }, { status: 400 });
      await query(
        `UPDATE probation SET pelanggaran_berat = true, pelanggaran_keterangan = $2, pelanggaran_at = now(),
           status = 'selesai', hasil = 'tidak_lanjut', diputuskan_oleh = $3, diputuskan_at = now(), updated_at = now()
         WHERE id = $1`,
        [prob.id, ket, denied.user.id]
      );
      return NextResponse.json({ ok: true, hasil: "tidak_lanjut", sebab: "pelanggaran_berat" });
    }

    // Keputusan akhir probation — tiga hasil resmi.
    if (body.aksi === "putuskan") {
      if (!adalahPimpinan(denied.user)) {
        return NextResponse.json({ ok: false, error: "Keputusan probation adalah wewenang pimpinan." }, { status: 403 });
      }
      if (prob.status !== "berjalan") {
        return NextResponse.json({ ok: false, error: "Masa probation sudah selesai." }, { status: 409 });
      }
      const hasil = String(body.hasil || "");
      if (hasil === "diangkat") {
        // Standar kelulusan: seluruh kompetensi inti pada sepuluh gugus
        // mencapai minimal Tingkat 3 Kompeten pada penilaian terakhir.
        const terakhir = await query<{ gugus: Array<{ nama: string; tingkat: number }> }>(
          "SELECT gugus FROM kompetensi_penilaian WHERE staff_id = $1 ORDER BY created_at DESC LIMIT 1",
          [prob.staff_id]
        );
        if (terakhir.length === 0 || (terakhir[0].gugus || []).length < JUMLAH_GUGUS) {
          return NextResponse.json(
            { ok: false, error: `Pengangkatan mensyaratkan penilaian kompetensi menyeluruh (${JUMLAH_GUGUS} gugus) pada masa Penilaian Standar.` },
            { status: 400 }
          );
        }
        const diBawah = terakhir[0].gugus.filter((g) => Number(g.tingkat) < TINGKAT_MINIMUM);
        if (diBawah.length > 0) {
          return NextResponse.json(
            { ok: false, error: `Standar kelulusan belum tercapai: gugus ${diBawah.map((g) => g.nama).join(", ")} masih di bawah Tingkat 3 Kompeten.` },
            { status: 400 }
          );
        }
      }
      if (hasil === "diperpanjang") {
        if (prob.perpanjangan_bulan) {
          return NextResponse.json({ ok: false, error: "Perpanjangan probation hanya satu kali, paling lama satu bulan." }, { status: 400 });
        }
        const rencana = String(body.rencana_perbaikan || "").trim();
        const bulan = Number(body.perpanjangan_bulan || 1);
        if (rencana.length < 5 || !(bulan >= 1 && bulan <= 1)) {
          return NextResponse.json(
            { ok: false, error: "Perpanjangan wajib disertai Rencana Perbaikan tertulis dan paling lama satu bulan." },
            { status: 400 }
          );
        }
        await query(
          `UPDATE probation SET hasil = 'diperpanjang', rencana_perbaikan = $2, perpanjangan_bulan = $3,
             diputuskan_oleh = $4, diputuskan_at = now(), updated_at = now() WHERE id = $1`,
          [prob.id, rencana, bulan, denied.user.id]
        );
        return NextResponse.json({ ok: true, hasil: "diperpanjang", status: "berjalan" });
      }
      if (hasil === "diangkat" || hasil === "tidak_lanjut") {
        await query(
          `UPDATE probation SET hasil = $2, status = 'selesai', diputuskan_oleh = $3, diputuskan_at = now(), updated_at = now() WHERE id = $1`,
          [prob.id, hasil, denied.user.id]
        );
        return NextResponse.json({ ok: true, hasil, status: "selesai" });
      }
      return NextResponse.json({ ok: false, error: "Hasil keputusan tidak dikenal." }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui probation.") }, { status: 500 });
  }
}
