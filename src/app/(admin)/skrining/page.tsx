"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Skrining & Rujukan: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/skrining/daftar", judul: "Klien & Pemeriksaan", keterangan: "Pendaftaran klien skrining dan daftar pemeriksaan tujuh jenis layanan." },
  { href: "/skrining/rujukan", judul: "Berkas Rujukan", keterangan: "Draf berkas rujukan — kolom tujuan selalu kosong sampai diterbitkan pendiri." },
  { href: "/skrining/bank", judul: "Bank Deteksi & Rujukan", keterangan: "Katalog acuan staf: 12 kelompok indikasi & ambang rujuk, bank program individual, 100 indikator usia sekolah, dan bank tugas risiko disleksia — bahan deteksi dini, bukan alat diagnosis." },
  { href: "/minat-bakat", judul: "Minat & Bakat", keterangan: "Layanan konsultasi terpisah untuk anak usia 4 tahun ke atas." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Skrining & Rujukan" subtitle="Pilih kamar Skrining & Rujukan — setiap bagian kini punya halamannya sendiri" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
        {KAMAR.map((k) => (
          <div className="card" key={k.href}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>{k.judul}</h2>
            <p className="muted" style={{ marginTop: 0 }}>{k.keterangan}</p>
            <Link className="btn" href={k.href}>Buka {k.judul}</Link>
          </div>
        ))}
      </div>
    </>
  );
}
