"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WA_LINK } from "@/lib/publik";

export type EventPublik = {
  id: string; nama: string; jenis: string; tema: string | null; tanggal: string | null;
  kuota: number | null; status: string; htm_reguler: number | null; htm_early_bird: number | null;
  terisi: number; menunggu_konfirmasi_akhir: boolean; dapat_daftar: boolean;
};
export type HargaFinal = { program: string; area: string | null; skema: string; komponen: Array<{ pos: string; jumlah: number }> };
export type DataPublik = {
  ok: boolean;
  identitas: { yayasan: string; gabungan: string; tagline: string; alamat: string };
  harga_final: HargaFinal[];
  event: EventPublik[];
  lowongan: Array<Record<string, unknown>>;
  artikel: Array<{ slug: string; judul: string; kategori: string | null; tanggal_terbit: string | null }>;
};

export function usePublik() {
  const [data, setData] = useState<DataPublik | null>(null);
  useEffect(() => {
    fetch("/api/publik").then((r) => r.json()).then((d) => { if (d.ok) setData(d); }).catch(() => undefined);
  }, []);
  return data;
}

const rupiah = (v: number) => `Rp ${Number(v || 0).toLocaleString("id-ID")}`;
const merek = (jenis: string) =>
  jenis === "event_alam" || jenis === "barefoot" ? "Sekolah Alam Montessori" : "Ziel Kids Club";

// Bagian Event dan Kegiatan Terdekat — event nyata dari sistem, apa adanya.
export function SeksiEvent() {
  const data = usePublik();
  if (!data) return <p>Sedang memuat event terdekat…</p>;
  const tampil = data.event.filter((e) => e.status !== "selesai");
  if (tampil.length === 0) {
    return <p>Belum ada event yang diumumkan saat ini. Event dan kelas pop up berjalan rutin sepanjang tahun — hubungi admin untuk jadwal berikutnya.</p>;
  }
  return (
    <>
      <div className="pb-grid">
        {tampil.map((e) => {
          const sisa = e.kuota !== null ? Math.max(0, e.kuota - e.terisi) : null;
          return (
            <article className="pb-card" key={e.id}>
              <p style={{ margin: "0 0 6px" }}>
                <span className="pb-badge">{merek(e.jenis)}</span>{" "}
                {e.menunggu_konfirmasi_akhir ? <span className="pb-badge konfirmasi">Menunggu konfirmasi akhir</span> : null}{" "}
                {e.status === "tutup" ? <span className="pb-badge tutup">Tutup</span> : null}
              </p>
              <h3>{e.nama}</h3>
              <p>
                {e.tema ? <>{e.tema}<br /></> : null}
                {e.tanggal ? <>Tanggal: {new Date(`${e.tanggal}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}<br /></> : null}
                {sisa !== null ? <>Sisa kuota: {sisa} dari {e.kuota}<br /></> : null}
                {e.htm_reguler ? <>Harga: {rupiah(e.htm_reguler)}{e.htm_early_bird ? ` · Early bird ${rupiah(e.htm_early_bird)}` : ""}</> : null}
              </p>
              <p style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {e.dapat_daftar ? <Link className="pb-btn" href={`/website/bergabung?event=${e.id}`}>Daftar Event Ini</Link> : null}
                <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Tanya via WhatsApp</a>
              </p>
            </article>
          );
        })}
      </div>
      <p style={{ color: "#57462f" }}>Event dan kelas pop up berjalan rutin sepanjang tahun.</p>
    </>
  );
}

// Bagian Investasi — hanya angka yang sudah Final dari skema lembaga.
// Program tanpa skema Final tampil dengan keterangan konfirmasi admin.
export function SeksiInvestasi() {
  const data = usePublik();
  if (!data) return <p>Sedang memuat informasi investasi…</p>;
  if (data.harga_final.length === 0) {
    return (
      <p>
        Informasi investasi program sedang difinalkan. Untuk angka yang pasti, silakan konfirmasi langsung
        kepada admin kami di nomor resmi — kami dengan senang hati menjelaskan rincian sesuai program anak Anda.
      </p>
    );
  }
  return (
    <div className="pb-grid">
      {data.harga_final.map((h) => (
        <article className="pb-card" key={h.program + h.skema}>
          <h3>{h.program}</h3>
          <p style={{ marginBottom: 6 }}><em>{h.skema}</em></p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#57462f", fontSize: 14.5 }}>
            {(h.komponen || []).map((k, i) => (
              <li key={i}>{k.pos}: <strong>{rupiah(k.jumlah)}</strong></li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
