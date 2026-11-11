"use client";

import { useIdentitas } from "./merek-sekolah";

// Penanda kategori program anak: ZKC cokelat natural, SAM hijau natural
// (warna dibaca dari Identitas Sekolah). Label status tampil apa adanya.

export function LencanaKategori({ kategori }: { kategori?: string | null }) {
  const identitas = useIdentitas();
  const sam = kategori === "SAM";
  const warna = sam ? identitas?.warna_sam || "#4F7A54" : identitas?.warna_zkc || "#8A6844";
  return (
    <span
      style={{
        display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11,
        fontWeight: 700, color: "#fff", background: warna, letterSpacing: "0.04em",
      }}
    >
      {sam ? "SAM" : "ZKC"}
    </span>
  );
}

export function LencanaLabel({ label }: { label?: string | null }) {
  if (!label || label === "Anggota") return null;
  return (
    <span
      style={{
        display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11,
        fontWeight: 600, color: "#5b4a2f", background: "#f3e8d3", border: "1px solid #e2d3ae",
      }}
    >
      {label}
    </span>
  );
}
