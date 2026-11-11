"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Rapor Perkembangan: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/rapor/buat", judul: "Buat & Unduh Massal", keterangan: "Buat draf rapor baru dan unduh massal PDF per siklus." },
  { href: "/rapor/daftar", judul: "Daftar Rapor", keterangan: "Semua rapor beserta tahap persetujuannya (draf, diperiksa, disetujui, terbit)." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Rapor Perkembangan" subtitle="Pilih kamar Rapor Perkembangan — setiap bagian kini punya halamannya sendiri" />
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
