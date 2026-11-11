"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import KesepakatanAwal from "@/components/kesepakatan-awal";
import { tanggalPanjang } from "@/lib/format";

type Aturan = {
  jenis: string; judul: string; isi: string; updated_at: string; diubah_oleh_nama: string | null;
};

const URUTAN: Array<[string, string]> = [
  ["guru", "Untuk guru & guide — tampil penuh di Portal Guru"],
  ["anak", "Kesepakatan positif anak — pegangan guru saat pendampingan"],
  ["anak_ramah", "Versi ramah anak — tampil di Portal Orang Tua"],
  ["ortu", "Untuk orang tua — tampil di Portal Orang Tua"],
];

export default function PeraturanPage() {
  const [aturan, setAturan] = useState<Aturan[] | null>(null);
  const [bolehUbah, setBolehUbah] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/peraturan")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        setAturan(d.peraturan);
        setBolehUbah(Boolean(d.boleh_ubah));
        const isi: Record<string, string> = {};
        for (const a of d.peraturan as Aturan[]) isi[a.jenis] = a.isi;
        setDraf(isi);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  async function simpan(a: Aturan) {
    setBusy(a.jenis);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/peraturan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jenis: a.jenis, judul: a.judul, isi: draf[a.jenis] }),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`${a.judul} diperbarui.`);
    load();
  }

  if (error && !aturan) return (<><PageHead title="Peraturan & Kesepakatan Bersama" /><ErrorState message={error} /></>);
  if (!aturan) return (<><PageHead title="Peraturan & Kesepakatan Bersama" /><LoadingState /></>);

  const perJenis = new Map(aturan.map((a) => [a.jenis, a]));

  return (
    <>
      <PageHead
        title="Peraturan & Kesepakatan Bersama"
        subtitle="Tiga perangkat aturan resmi lembaga, ditulis bermartabat dan positif — tanpa kata sanksi atau denda untuk orang tua dan anak"
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      {!bolehUbah ? (
        <p className="muted">Anda dapat membaca seluruh peraturan. Pembaruan hanya oleh founder dan manager.</p>
      ) : null}

      {URUTAN.map(([jenis, ket]) => {
        const a = perJenis.get(jenis);
        if (!a) return null;
        return (
          <div className="card" key={jenis} style={{ marginBottom: 12 }}>
            <h2 style={{ marginTop: 0 }}>{a.judul}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {ket} · Terakhir diperbarui {tanggalPanjang(a.updated_at)}{a.diubah_oleh_nama ? ` oleh ${a.diubah_oleh_nama}` : ""}
            </p>
            {bolehUbah ? (
              <>
                <div className="field">
                  <label htmlFor={`isi_${jenis}`}>Isi peraturan (satu butir per baris)</label>
                  <textarea
                    id={`isi_${jenis}`}
                    rows={10}
                    value={draf[jenis] ?? a.isi}
                    onChange={(e) => setDraf({ ...draf, [jenis]: e.target.value })}
                  />
                </div>
                <button className="btn secondary" type="button" disabled={busy === jenis} style={{ marginTop: 8 }} onClick={() => void simpan(a)}>
                  {busy === jenis ? "Menyimpan…" : "Simpan Pembaruan"}
                </button>
              </>
            ) : (
              <ul>
                {a.isi.split("\n").map((baris) => baris.trim()).filter(Boolean).map((baris) => (
                  <li key={baris}>{baris}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Kesepakatan Awal Keluarga</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Bacaan yang dicentang orang tua pada Formulir Trial dan registrasi; tertaut dari halaman ini
          dan tercatat persetujuannya pada profil anak serta Portal Orang Tua.
        </p>
        <KesepakatanAwal />
      </div>
    </>
  );
}
