"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Ailsa: pintu ke kamar-kamar Ailsa. Isi setiap kamar persis
// seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string }> = [
  { href: "/ailsa/kanal", judul: "Kanal & Kunci LLM", keterangan: "Status kanal WhatsApp dan kunci DeepSeek yang diisi admin dari aplikasi." },
  { href: "/ailsa/simulator", judul: "Simulator & Buat Konten", keterangan: "Simulator Ailsa Tahap 0 (panel staf) dan pembuatan konten dengan Ailsa." },
  { href: "/ailsa/pesan", judul: "Pesan Tes & Pengaturan", keterangan: "Kirim pesan tes dan pengaturan perilaku Ailsa." },
  { href: "/ailsa/percakapan", judul: "Percakapan Terbaru", keterangan: "Percakapan terakhir Ailsa dengan orang tua dan lead." },
  { href: "/ailsa/pengetahuan", judul: "Bank Pengetahuan", keterangan: "Pertanyaan tak terjawab dan butir pengetahuan yang disetujui manusia." },
];

export default function AilsaHubPage() {
  return (
    <>
      <PageHead title="Ailsa" subtitle="Pilih kamar Ailsa — setiap bagian kini punya halamannya sendiri" />
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
