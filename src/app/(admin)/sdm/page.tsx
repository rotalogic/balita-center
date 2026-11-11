"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk SDM: pintu ke kamar-kamar dan perangkat SDM lembaga.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/sdm/staf", judul: "Data Staf & Guru", keterangan: "Daftar staf dan guru beserta jabatan, cabang, dan statusnya." },
  { href: "/sdm/cuti", judul: "Cuti / Izin / Lembur", keterangan: "Pengajuan, persetujuan, dan permintaan cuti terbaru." },
  { href: "/sdm/kompetensi", judul: "Kompetensi Guru", keterangan: "Penilaian 10 gugus kompetensi Tingkat 1–4 dan gerbang pengangkatan." },
  { href: "/sdm/probation", judul: "Probation", keterangan: "Masa percobaan 3 bulan: persetujuan tiga pihak dan keputusan akhir." },
  { href: "/sdm/rekrutmen", judul: "Rekrutmen", keterangan: "Lowongan, lamaran masuk dengan CV wajib, dan alur seleksi." },
  { href: "/papan-poin", judul: "Papan Poin Guru", keterangan: "Urutan poin penilaian guru oleh orang tua per periode." },
];

export default function SdmHubPage() {
  return (
    <>
      <PageHead title="SDM" subtitle="Pilih kamar SDM — setiap bagian kini punya halamannya sendiri" />
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
