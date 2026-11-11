"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import { PETA_POS_PEMAKAIAN } from "@/lib/bahan-ajar";

// Halaman induk Bahan Ajar: pintu ke tiga kamar bahan & program khusus.
// Kerangka Tahap 2 — isi resmi dimuat dari Paket Sistem Terpadu lembaga.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/bahan-ajar/pelengkap", judul: "Bahan Ajar Pelengkap", keterangan: "Islamic Living (doa, hadis, surah, hijaiyah, bacaan Ummi), Bahasa Inggris ZKC, dan Bahasa Arab SAM." },
  { href: "/bahan-ajar/bank-sesi", judul: "Bank Sesi Pendampingan Individual", keterangan: "Kumpulan rencana sesi pendampingan satu anak per sesi, berjalan sesudah pukul 13.00." },
  { href: "/bahan-ajar/calistung", judul: "Program Khusus Calistung", keterangan: "Tahapan dan materi program khusus calistung Ziel Kids Club dengan aparaturnya." },
  { href: "/bahan-ajar/kurikulum", judul: "Kurikulum ZKC 14 Bulan", keterangan: "Tema, fondasi, materi inti, menu sensory & movement, dan subtema mingguan Nov 2026–Des 2027, plus peta materi Kelas Movement." },
];

export default function BahanAjarHubPage() {
  return (
    <>
      <PageHead title="Bahan Ajar" subtitle="Pilih kamar Bahan Ajar — setiap bagian kini punya halamannya sendiri" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
        {KAMAR.map((k) => (
          <div className="card" key={k.href}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>{k.judul}</h2>
            <p className="muted" style={{ marginTop: 0 }}>{k.keterangan}</p>
            <Link className="btn" href={k.href}>Buka {k.judul}</Link>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Peta Pos Pemakaian Materi Acuan</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Kaidah prompt lembaga: setiap tabel materi wajib masuk ke pembelajaran dan tampil di laporan sesuai
          posnya. Tabel yang belum mempunyai pos dinyatakan terbuka sebagai pekerjaan yang belum selesai —
          peta ini menampilkannya apa adanya.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tabel Materi</th><th>Pos di Pembelajaran</th><th>Pos di Laporan</th><th>Status</th></tr></thead>
            <tbody>
              {PETA_POS_PEMAKAIAN.map((p) => (
                <tr key={p.tabel}>
                  <td><strong>{p.tabel}</strong></td>
                  <td>{p.pembelajaran}</td>
                  <td>{p.laporan}</td>
                  <td>{p.berpos ? <span className="badge ok">Sudah berpos</span> : <span className="badge warn">Pekerjaan terbuka</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
