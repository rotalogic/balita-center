"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Surat & Proposal: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/surat/buat", judul: "Buat Surat dari Template", keterangan: "Surat keputusan dan proposal dari template dengan penomoran otomatis saat terbit." },
  { href: "/surat/arsip", judul: "Arsip Surat", keterangan: "Surat terbit dan draf beserta nomor resminya." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Surat & Proposal" subtitle="Pilih kamar Surat & Proposal — setiap bagian kini punya halamannya sendiri" />
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
