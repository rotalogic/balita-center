import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { getIdentitas } from "@/lib/sekolah";

export const dynamic = "force-dynamic";

// Data publik website — satu data dengan sistem, disaring kaidah halaman
// publik: hanya skema biaya berstatus Final yang angkanya tampil (yang
// belum final diganti keterangan konfirmasi admin), seri Pop Up ditandai
// menunggu konfirmasi akhir, Holiday Camp tampil Tutup, dan tidak ada
// rincian dapur apa pun.
export async function GET() {
  try {
    const identitas = await getIdentitas();
    const [harga, event, lowongan, artikel] = await Promise.all([
      query(
        `SELECT p.name AS program, p.area, s.nama AS skema, s.komponen
           FROM programs p
           JOIN skema_biaya s ON s.id = p.skema_id AND s.status = 'final'
          WHERE p.deleted_at IS NULL
          ORDER BY p.area, p.name`
      ),
      query(
        `SELECT e.id, e.nama, e.jenis, e.tema, e.tanggal::text AS tanggal, e.kuota, e.status,
                e.htm_reguler::float8 AS htm_reguler, e.htm_early_bird::float8 AS htm_early_bird,
                (SELECT COUNT(*)::int FROM insidentil i WHERE i.event_edisi_id = e.id AND i.status <> 'batal') AS terisi
           FROM event_edisi e
          WHERE e.status IN ('buka','tutup','selesai')
          ORDER BY (e.tanggal IS NULL), e.tanggal
          LIMIT 40`
      ),
      query(
        `SELECT id, judul, program_label, deskripsi, syarat_mutlak, pertanyaan
           FROM lowongan WHERE status = 'buka' ORDER BY created_at`
      ),
      query("SELECT slug, judul, kategori, tanggal_terbit::text AS tanggal_terbit FROM artikel ORDER BY tanggal_terbit"),
    ]);
    const eventPublik = (event as Array<Record<string, unknown>>).map((e) => ({
      ...e,
      menunggu_konfirmasi_akhir: e.jenis === "pop_up",
      dapat_daftar: e.status === "buka" && Number(e.terisi || 0) < Number(e.kuota || 0),
    }));
    return NextResponse.json({
      ok: true,
      identitas: {
        yayasan: identitas.nama_yayasan,
        gabungan: identitas.nama_gabungan,
        tagline: identitas.tagline_gabungan,
        alamat: identitas.alamat,
      },
      harga_final: harga,
      event: eventPublik,
      lowongan,
      artikel,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
