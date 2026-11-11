"use client";

import { useEffect, useState } from "react";

// Merek lembaga dari identitas (Pengaturan): logo + kop tiga baris.
// Memuat sekali per sesi dari /api/identitas.

type Identitas = {
  nama: string; tagline: string; logo_url: string | null;
  nama_yayasan?: string; nama_gabungan?: string; tagline_gabungan?: string;
  warna_zkc?: string; warna_sam?: string;
};

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

// Kop resmi tiga baris yang terkunci: yayasan, nama gabungan dua rumah,
// tagline gabungan. Dipakai di kepala laporan & rapor web (menyamai PDF);
// logo tampil di kiri bila sudah diunggah.
export function MerekSekolah({ gayaLogo }: { gayaLogo?: React.CSSProperties }) {
  const identitas = useIdentitas();
  if (!identitas) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      {identitas.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/api/identitas/logo" alt={`Logo ${identitas.nama}`} style={{ height: 40, maxWidth: 120, objectFit: "contain", ...gayaLogo }} />
      ) : null}
      <div>
        <div style={{ color: "#77828e", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {identitas.nama_yayasan || identitas.nama}
        </div>
        <div style={{ color: "#2f353c", fontWeight: 800, fontSize: 14.5, letterSpacing: "0.02em" }}>
          {identitas.nama_gabungan || identitas.nama}
        </div>
        <div style={{ color: "#77828e", fontSize: 11 }}>
          {identitas.tagline_gabungan || identitas.tagline}
        </div>
      </div>
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
