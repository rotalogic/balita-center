"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";

type Surat = Record<string, string | null> & { id: string; status: string };

export default function SuratDetailPage({ params }: { params: { id: string } }) {
  const [s, setS] = useState<Surat | null>(null);
  const [perihal, setPerihal] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [isi, setIsi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/surat/${params.id}`).then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        setS(d.surat);
        setPerihal(String(d.surat.perihal || ""));
        setTujuan(String(d.surat.tujuan || ""));
        setIsi(String(d.surat.isi || ""));
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/surat/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(d.nomor ? `${pesan} Nomor: ${d.nomor}` : pesan);
    load();
  }

  if (error && !s) return (<><PageHead title="Surat" /><ErrorState message={error} /></>);
  if (!s) return (<><PageHead title="Surat" /><LoadingState /></>);
  const draf = s.status === "draft";

  return (
    <>
      <PageHead
        title={perihal || "Surat"}
        subtitle={s.nomor ? `Nomor ${s.nomor} · ${s.status === "terbit" ? "Terbit" : "Arsip"}` : "Draf — belum bernomor"}
        action={<Link className="btn secondary" href="/surat">&larr; Arsip Surat</Link>}
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="card">
        <div className="field"><label htmlFor="sd_perihal">Perihal</label>
          <input id="sd_perihal" value={perihal} disabled={!draf} onChange={(e) => setPerihal(e.target.value)} /></div>
        <div className="field"><label htmlFor="sd_tujuan">Kepada / Tujuan</label>
          <input id="sd_tujuan" value={tujuan} disabled={!draf} onChange={(e) => setTujuan(e.target.value)} /></div>
        <div className="field"><label htmlFor="sd_isi">Isi surat</label>
          <textarea id="sd_isi" rows={12} value={isi} disabled={!draf} onChange={(e) => setIsi(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {draf ? (
            <>
              <button className="btn secondary" type="button" disabled={busy}
                onClick={() => void patch({ perihal, tujuan, isi }, "Draf surat tersimpan.")}>Simpan Draf</button>
              <button className="btn" type="button" disabled={busy}
                onClick={() => void patch({ aksi: "terbitkan" }, "Surat diterbitkan.")}>Terbitkan &amp; Beri Nomor (Founder/Manager)</button>
            </>
          ) : null}
          <a className="btn secondary" href={`/api/dokumen/surat/${s.id}`} target="_blank" rel="noreferrer">Cetak / Unduh PDF Berkop</a>
          {s.status === "terbit" ? (
            <button className="btn secondary" type="button" disabled={busy}
              onClick={() => void patch({ aksi: "arsipkan" }, "Surat diarsipkan.")}>Arsipkan</button>
          ) : null}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Cetak memakai kop tiga baris identitas lembaga. Penomoran otomatis berformat nomor urut, kode jenis,
          bulan Romawi, dan tahun — diberikan tepat saat penerbitan, tidak pernah pada draf.
        </p>
      </div>
    </>
  );
}
