"use client";

import { useEffect, useState } from "react";

// Merek sekolah dari identitas (Pengaturan): logo + baris kop.
// Memuat sekali per sesi dari /api/identitas; tampil hanya bila sekolah
// sudah mengunggah logo, supaya tata letak tanpa logo tidak berubah.

type Identitas = { nama: string; tagline: string; logo_url: string | null };

let janji: Promise<Identitas | null> | null = null;
function muat(): Promise<Identitas | null> {
  if (!janji) {
    janji = fetch("/api/identitas")
      .then((r) => r.json())
      .then((d) => (d.ok ? (d.identitas as Identitas) : null))
      .catch(() => null);
  }
  return janji;
}

export function useIdentitas(): Identitas | null {
  const [data, setData] = useState<Identitas | null>(null);
  useEffect(() => {
    let hidup = true;
    void muat().then((d) => (hidup ? setData(d) : null));
    return () => {
      hidup = false;
    };
  }, []);
  return data;
}

// Baris merek ringkas: logo di kiri, kop sekolah di sampingnya.
// Dipakai di kepala laporan & rapor web (menyamai PDF).
export function MerekSekolah({ gayaLogo }: { gayaLogo?: React.CSSProperties }) {
  const identitas = useIdentitas();
  if (!identitas?.logo_url) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/identitas/logo" alt={`Logo ${identitas.nama}`} style={{ height: 34, maxWidth: 120, objectFit: "contain", ...gayaLogo }} />
      <span style={{ color: "#77828e", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {identitas.tagline ? `${identitas.nama} — ${identitas.tagline}` : identitas.nama}
      </span>
    </div>
  );
}

// Merek aplikasi untuk sidebar & layar login: logo sekolah bila ada,
// selain itu lambang bunga + nama identitas (bawaan "Balita Center").
export function MerekAplikasi() {
  const identitas = useIdentitas();
  if (identitas?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/api/identitas/logo" alt={identitas.nama} style={{ maxHeight: 40, maxWidth: 132, objectFit: "contain" }} />
    );
  }
  return (
    <>
      <span className="brand-mark" aria-hidden="true">✿</span>
      <span className="brand-name">{identitas?.nama || "Balita Center"}</span>
    </>
  );
}
