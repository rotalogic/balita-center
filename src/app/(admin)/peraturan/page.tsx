"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Peraturan & Kesepakatan Bersama: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/peraturan/aturan", judul: "Peraturan Tiga Pihak", keterangan: "Peraturan untuk sekolah, orang tua, dan versi ramah anak — diperbarui oleh pimpinan." },
  { href: "/peraturan/kesepakatan", judul: "Kesepakatan Awal Keluarga", keterangan: "Teks kesepakatan yang dicentang orang tua pada Formulir Trial dan registrasi." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Peraturan & Kesepakatan Bersama" subtitle="Pilih kamar Peraturan & Kesepakatan Bersama — setiap bagian kini punya halamannya sendiri" />
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
