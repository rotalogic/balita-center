"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Program Event: pintu ke kamar-kamarnya. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/event/buat", judul: "Buat Edisi Baru", keterangan: "Edisi Pop Up Class, Holiday Camp, dan edisi khusus beserta kuotanya." },
  { href: "/event/daftar", judul: "Daftar Edisi", keterangan: "Semua edisi event beserta status dan jumlah pesertanya." },
];

export default function HubPage() {
  return (
    <>
      <PageHead title="Program Event" subtitle="Pilih kamar Program Event — setiap bagian kini punya halamannya sendiri" />
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
