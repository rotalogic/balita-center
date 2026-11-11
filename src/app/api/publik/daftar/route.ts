import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { JENIS_SKRINING } from "@/lib/skrining";
import { NAMA_LAYANAN } from "@/lib/minat";

export const dynamic = "force-dynamic";

// Formulir pendaftaran ringan website (bergaya Formulir Insidentil).
// Setiap kiriman mengalir masuk ke modul Penerimaan mengikuti jalur ringan
// insidentil — dengan status dan tanggal masuknya, mengurangi kuota event
// yang berlaku, dan memicu pemberitahuan kepada admin. Formulir ini TIDAK
// mengemas isian menjadi pesan WhatsApp dan tidak mengalihkan pengunjung.
const LAYANAN_SKRINING = new Set(JENIS_SKRINING.map(([k]) => k));

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (String(body.situs_web || "")) {
      // Kolom jebakan bot — manusia tidak pernah mengisinya.
      return NextResponse.json({ ok: true });
    }
    const namaAnak = String(body.child_name || "").trim();
    const namaOrtu = String(body.parent_name || "").trim();
    const wa = String(body.wa_number || "").replace(/[^\d+]/g, "");
    if (namaAnak.length < 2 || namaOrtu.length < 2) {
      return NextResponse.json({ ok: false, error: "Nama anak dan nama orang tua wajib diisi." }, { status: 400 });
    }
    if (wa.length < 8) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp wajib diisi dengan benar." }, { status: 400 });
    }

    const pilihan = String(body.pilihan || "");
    let jenis = "edukasi";
    let label = "";
    let edisiId: string | null = null;
    let biaya: number | null = null;
    let butuhTanggal = true;
    const konsultasi = pilihan === "konsultasi" || pilihan === "minat_bakat";

    if (pilihan === "zkc") { jenis = "zkc"; label = "Program Ziel Kids Club"; }
    else if (pilihan === "sam") { jenis = "sam"; label = "Program Sekolah Alam Montessori"; }
    else if (pilihan.startsWith("event:")) {
      edisiId = pilihan.slice(6);
      const edisi = await query<{ nama: string; jenis: string; status: string; tanggal: string | null; kuota: number | null; htm_reguler: string | null; htm_early_bird: string | null }>(
        "SELECT nama, jenis, status, tanggal::text AS tanggal, kuota, htm_reguler, htm_early_bird FROM event_edisi WHERE id = $1",
        [edisiId]
      );
      if (edisi.length === 0) return NextResponse.json({ ok: false, error: "Edisi event tidak ditemukan." }, { status: 404 });
      const e = edisi[0];
      if (e.status !== "buka") {
        return NextResponse.json({ ok: false, error: "Pendaftaran edisi ini belum dibuka atau sudah ditutup." }, { status: 400 });
      }
      if (e.htm_reguler === null && e.htm_early_bird === null) {
        return NextResponse.json({ ok: false, error: "Harga edisi ini belum ditetapkan — pendaftaran belum dibuka." }, { status: 400 });
      }
      const terisi = await query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM insidentil WHERE event_edisi_id = $1 AND status <> 'batal'", [edisiId]
      );
      if (e.kuota !== null && Number(terisi[0].n) >= e.kuota) {
        return NextResponse.json({ ok: false, error: "Kuota edisi ini sudah penuh." }, { status: 400 });
      }
      jenis = e.jenis === "event_alam" || e.jenis === "barefoot" ? "event_alam" : e.jenis === "pop_up" ? "pop_up" : "edukasi";
      label = e.nama;
      biaya = Number(body.tarif_jenis === "early_bird" && e.htm_early_bird !== null ? e.htm_early_bird : e.htm_reguler) || null;
      if (e.tanggal) body.tanggal = e.tanggal;
    }
    else if (pilihan.startsWith("skrining:")) {
      const jenisSkrining = pilihan.slice(9);
      if (!LAYANAN_SKRINING.has(jenisSkrining)) {
        return NextResponse.json({ ok: false, error: "Jenis skrining tidak dikenal." }, { status: 400 });
      }
      label = `Layanan Skrining — ${JENIS_SKRINING.find(([k]) => k === jenisSkrining)?.[1] || ""}`;
      butuhTanggal = false;
    }
    else if (pilihan === "minat_bakat") { label = NAMA_LAYANAN; butuhTanggal = false; }
    else if (pilihan === "konsultasi") { label = "Konsultasi"; butuhTanggal = false; }
    else {
      return NextResponse.json({ ok: false, error: "Pilihan kegiatan tidak dikenal." }, { status: 400 });
    }

    // Gerbang alergi berdiri sendiri — sama seperti formulir insidentil.
    const alergiTidakAda = Boolean(body.alergi_tidak_ada);
    const alergiJenis = String(body.alergi_jenis || "").trim();
    if (!alergiTidakAda && !alergiJenis) {
      return NextResponse.json(
        { ok: false, error: "Kolom alergi wajib diisi, atau pilih \"Tidak Ada Alergi yang Diketahui\"." },
        { status: 400 }
      );
    }
    if (!Boolean(body.setuju_dokumentasi)) {
      return NextResponse.json(
        { ok: false, error: "Centang persetujuan dokumentasi foto wajib diisi." },
        { status: 400 }
      );
    }
    const berbayar = biaya !== null;
    if (berbayar && !Boolean(body.setuju_ketentuan_bayar)) {
      return NextResponse.json(
        { ok: false, error: "Kegiatan berbayar mewajibkan centang persetujuan bahwa pembayaran tidak dapat dibatalkan dan tidak dapat dikembalikan." },
        { status: 400 }
      );
    }

    const hariIni = new Date().toISOString().slice(0, 10);
    const tanggal = butuhTanggal ? String(body.tanggal || "") : hariIni;
    if (butuhTanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ ok: false, error: "Tanggal kegiatan yang diinginkan wajib diisi." }, { status: 400 });
    }
    const tglLahir = body.child_birth_date ? String(body.child_birth_date).slice(0, 10) : null;

    const rows = await query<{ id: string }>(
      `INSERT INTO insidentil
         (child_name, child_birth_date, parent_name, wa_number, email,
          kegiatan_jenis, kegiatan_label, tanggal, berbayar, biaya,
          setuju_ketentuan_bayar, setuju_ketentuan_bayar_at,
          alergi_tidak_ada, alergi_jenis, alergi_pemicu,
          setuju_dokumentasi, catatan, event_edisi_id, tarif_jenis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        namaAnak, tglLahir, namaOrtu, wa, body.email ? String(body.email) : null,
        jenis, label, tanggal, berbayar, biaya,
        Boolean(body.setuju_ketentuan_bayar),
        body.setuju_ketentuan_bayar ? new Date().toISOString() : null,
        alergiTidakAda, alergiTidakAda ? null : alergiJenis || null,
        body.kebutuhan_khusus ? String(body.kebutuhan_khusus) : null,
        true,
        `Pendaftaran ringan dari website — pilihan: ${label}.` + (konsultasi ? " Jadwal konsultasi diatur lembaga." : ""),
        edisiId, body.tarif_jenis === "early_bird" ? "early_bird" : "reguler",
      ]
    );

    // Pemberitahuan kepada admin (pemilik & pengelola) di dalam sistem.
    await query(
      `INSERT INTO notifications (user_id, title, body, href)
       SELECT DISTINCT u.id, 'Pendaftaran baru dari website',
              $1, '/admission/insidentil'
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.role IN ('owner','super_admin') OR r.code IN ('owner','super_admin')`,
      [`${namaAnak} mendaftar ${label} lewat formulir website (orang tua: ${namaOrtu}).`]
    ).catch(() => undefined);

    return NextResponse.json({
      ok: true, id: rows[0].id,
      ringkasan: { anak: namaAnak, pilihan: label, tanggal: butuhTanggal ? tanggal : null, konsultasi },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengirim formulir. Coba lagi.") }, { status: 500 });
  }
}
