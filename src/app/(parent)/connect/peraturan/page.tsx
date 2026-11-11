"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";

type Aturan = { jenis: string; judul: string; isi: string };
type KesepakatanAnak = {
  child_id: string; child_name: string; disetujui: boolean;
  nama_penyetuju: string | null; disetujui_at: string | null; sumber: string | null;
};
type Data = {
  peraturan: Aturan[];
  kesepakatan_teks: {
    judul: string; pembuka: string; umum: string[]; sam: string[]; zkc: string[]; kalimatCentang: string;
  };
  kesepakatan: KesepakatanAnak[];
};

export default function ConnectPeraturanPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/connect/peraturan")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  if (error && !data) return (<><PageHead title="Peraturan & Kesepakatan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Peraturan & Kesepakatan" /><LoadingState /></>);

  return (
    <>
      <PageHead title="Peraturan & Kesepakatan" subtitle="Kesepakatan bersama keluarga dan sekolah, untuk dibaca kapan pun" />
      {data.peraturan.map((a) => (
        <div className="card" key={a.jenis} style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>{a.judul}</h2>
          <ul>
            {a.isi.split("\n").map((b) => b.trim()).filter(Boolean).map((b) => (<li key={b}>{b}</li>))}
          </ul>
        </div>
      ))}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{data.kesepakatan_teks.judul}</h2>
        <p>{data.kesepakatan_teks.pembuka}</p>
        <h3>Kesepakatan bersama</h3>
        <ul>{data.kesepakatan_teks.umum.map((b) => (<li key={b}>{b}</li>))}</ul>
        <h3>Untuk keluarga Sekolah Alam Montessori</h3>
        <ul>{data.kesepakatan_teks.sam.map((b) => (<li key={b}>{b}</li>))}</ul>
        <h3>Untuk keluarga Ziel Kids Club</h3>
        <ul>{data.kesepakatan_teks.zkc.map((b) => (<li key={b}>{b}</li>))}</ul>

        <h3>Status Persetujuan Keluarga Anda</h3>
        {data.kesepakatan.length === 0 ? (
          <EmptyState title="Belum terhubung ke data anak" body="Status kesepakatan tampil sesudah akun Anda terhubung ke data anak." />
        ) : (
          <ul>
            {data.kesepakatan.map((k) => (
              <li key={k.child_id}>
                <strong>{k.child_name}</strong>:{" "}
                {k.disetujui
                  ? <>sudah disetujui{k.nama_penyetuju ? ` oleh ${k.nama_penyetuju}` : ""}{k.disetujui_at ? ` pada ${tanggalPanjang(k.disetujui_at)}` : ""}.</>
                  : "belum tercatat — sampaikan kepada admin sekolah bila Anda sudah menyetujuinya."}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
