"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Bahan Ajar: pintu ke tiga kamar bahan & program khusus.
// Kerangka Tahap 2 — isi resmi dimuat dari Paket Sistem Terpadu lembaga.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/bahan-ajar/pelengkap", judul: "Bahan Ajar Pelengkap", keterangan: "Islamic Living (doa, hadis, surah, hijaiyah, bacaan Ummi), Bahasa Inggris ZKC, dan Bahasa Arab SAM." },
  { href: "/bahan-ajar/bank-sesi", judul: "Bank Sesi Pendampingan Individual", keterangan: "Kumpulan rencana sesi pendampingan satu anak per sesi, berjalan sesudah pukul 13.00." },
  { href: "/bahan-ajar/calistung", judul: "Program Khusus Calistung", keterangan: "Tahapan dan materi program khusus calistung Ziel Kids Club dengan aparaturnya." },
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
    </>
  );
}
