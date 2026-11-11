"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/chrome";

// Halaman induk Akademik: pintu ke kamar-kamar Akademik. Isi setiap kamar
// persis seperti sebelumnya — hanya tempatnya yang kini berdiri sendiri.
const KAMAR: Array<{ href: string; judul: string; keterangan: string; kunci: "cycles" | "stppa" | "materials" | "milestones" | "events" | null }> = [
  { href: "/akademik/siklus", judul: "Siklus Belajar", keterangan: "Tema dan periode siklus belajar per kelas.", kunci: "cycles" },
  { href: "/akademik/stppa", judul: "Butir STPPA", keterangan: "Butir capaian per kelompok usia dan aspek, termasuk impor CSV.", kunci: "stppa" },
  { href: "/akademik/material", judul: "Katalog Material Montessori AMI", keterangan: "Material aktif/nonaktif dan pemetaannya ke milestone.", kunci: "materials" },
  { href: "/akademik/milestone", judul: "Katalog Milestone Perkembangan", keterangan: "Indikator perkembangan: draf, aktif, dan arsip.", kunci: "milestones" },
  { href: "/akademik/promosi", judul: "Promosi / Kenaikan Kelas", keterangan: "Pindahkan anak ke kelas tujuan dalam cabang yang sama.", kunci: null },
  { href: "/akademik/kegiatan", judul: "Kegiatan Sekolah", keterangan: "Kegiatan dan hari libur yang tampil di Dashboard dan Balita Connect.", kunci: "events" },
];

export default function AkademikHubPage() {
  const [jumlah, setJumlah] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/academic")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok !== false) {
          setJumlah({
            cycles: (d.cycles || []).length,
            stppa: (d.stppa || []).length,
            materials: (d.materials || []).length,
            milestones: (d.milestones || []).length,
            events: (d.events || []).length,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <PageHead title="Akademik" subtitle="Pilih kamar Akademik — setiap bagian kini punya halamannya sendiri" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
        {KAMAR.map((k) => (
          <div className="card" key={k.href}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>
              {k.judul}
              {k.kunci && jumlah[k.kunci] !== undefined ? <span className="muted"> ({jumlah[k.kunci]})</span> : null}
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>{k.keterangan}</p>
            <Link className="btn" href={k.href}>Buka {k.judul}</Link>
          </div>
        ))}
      </div>
    </>
  );
}
