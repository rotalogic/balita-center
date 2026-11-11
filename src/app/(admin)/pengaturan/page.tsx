"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Pengaturan: pintu ke kamar-kamar Pengaturan. Isi setiap
// kamar persis seperti sebelumnya — hanya tempatnya yang berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/pengaturan/identitas", judul: "Identitas Sekolah", keterangan: "Nama, kop resmi tiga baris, logo, visi, misi, dan motto lembaga." },
  { href: "/pengaturan/status", judul: "Status Konfigurasi", keterangan: "Kesiapan database, email, gateway, kunci AI, dan penyimpanan — tanpa menampilkan nilai kunci." },
  { href: "/pengaturan/akses", judul: "Peran & Pengguna", keterangan: "Pemetaan peran dan izin RBAC beserta daftar pengguna terpetakan." },
  { href: "/pengaturan/audit", judul: "Jejak Audit", keterangan: "Ringkasan jejak audit dan pintu ke halaman penyelidikannya." },
  { href: "/pengaturan/penyimpanan", judul: "Penyimpanan Foto", keterangan: "Driver penyimpanan aktif untuk foto dan media laporan." },
];

export default function PengaturanHubPage() {
  return (
    <>
      <PageHead title="Pengaturan" subtitle="Pilih kamar Pengaturan — setiap bagian kini punya halamannya sendiri" />
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
