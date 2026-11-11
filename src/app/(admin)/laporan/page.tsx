"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Laporan: pintu ke kamar-kamar Laporan.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/laporan/daftar", judul: "Daftar Laporan", keterangan: "Filter tanggal/cabang/kelas/status, ringkasan, dan ekspor CSV/XLSX." },
  { href: "/laporan/audit", judul: "Jejak Audit", keterangan: "Jejak perubahan pada laporan: siapa melakukan apa dan kapan." },
];

export default function LaporanHubPage() {
  return (
    <>
      <PageHead title="Laporan" subtitle="Pilih kamar Laporan — setiap bagian kini punya halamannya sendiri" />
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
