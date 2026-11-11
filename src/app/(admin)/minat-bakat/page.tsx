"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Minat & Bakat: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/minat-bakat/layanan", judul: "Kartu Layanan", keterangan: "Penjelasan layanan Konsultasi dan Pemetaan Kekuatan & Minat Anak beserta plakatnya." },
  { href: "/minat-bakat/klien", judul: "Klien Konsultasi", keterangan: "Pendaftaran klien konsultasi baru dan daftar klien terdaftar." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Minat & Bakat" subtitle="Pilih kamar Minat & Bakat — setiap bagian kini punya halamannya sendiri" />
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
