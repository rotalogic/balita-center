"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Keuangan: pintu ke kamar-kamar Keuangan. Isi setiap kamar
// persis seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/keuangan/skema", judul: "Skema Biaya Lembaga", keterangan: "Skema Final/Rancangan per program — Rancangan terkunci dari invoice dan pembayaran." },
  { href: "/keuangan/buat", judul: "Buat Tagihan", keterangan: "Tagihan SPP massal bulan ini dan tagihan per anak untuk periode tertentu." },
  { href: "/keuangan/tagihan", judul: "Daftar Tagihan", keterangan: "Semua tagihan dengan pencarian, tagihan terbaru, konfirmasi, cetak, dan kwitansi." },
  { href: "/keuangan/kas", judul: "Buku Kas", keterangan: "Entri pemasukan dan pengeluaran terakhir beserta koreksi reversalnya." },
  { href: "/keuangan/gateway", judul: "Payment Gateway — Midtrans", keterangan: "Kunci gateway dan pengaktifan tombol Bayar Sekarang di Balita Connect." },
];

export default function KeuanganHubPage() {
  return (
    <>
      <PageHead title="Keuangan" subtitle="Pilih kamar Keuangan — setiap bagian kini punya halamannya sendiri" />
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
