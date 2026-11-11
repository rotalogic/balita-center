"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { RaporWeb, type RaporData } from "@/components/rapor-web";
import type { AgregatRapor } from "@/lib/rapor-data";

type AksiTersedia = { periksa: boolean; setujui: boolean; terbit: boolean; kembalikan: boolean; tarik: boolean };

const TAHAP: Array<[string, string]> = [
  ["draft", "1 · Draf Guru"],
  ["diperiksa", "2 · Diperiksa Manager"],
  ["disetujui", "3 · Disetujui Founder"],
  ["published", "4 · Terbit"],
];

export default function RaporViewPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<RaporData | null>(null);
  const [agregat, setAgregat] = useState<AgregatRapor | null>(null);
  const [aksi, setAksi] = useState<AksiTersedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/rapor/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Rapor tidak bisa dimuat."); return; }
        setReport(d.report);
        setAgregat(d.agregat);
        setAksi(d.aksi_tersedia || null);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function jalankan(aksiNama: string, pesan: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/rapor/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: aksiNama }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) {
      setInfo(pesan);
      load();
    } else {
      setError(d.error || "Gagal menjalankan tahap rapor.");
    }
  }

  if (error && !report) {
    return (<><PageHead title="Rapor Perkembangan" /><ErrorState message={error} />
      <p style={{ marginTop: 12 }}><Link className="btn secondary" href="/rapor">&larr; Kembali ke daftar</Link></p></>);
  }
  if (!report || !agregat) return (<><PageHead title="Rapor Perkembangan" /><LoadingState /></>);

  const status = String(report.status);
  const terbit = status === "published";
  const idxTahap = TAHAP.findIndex(([k]) => k === status);

  return (
    <>
      <PageHead
        title="Rapor Perkembangan"
        subtitle={`${String(report.child_name)} · ${String(report.cycle_theme)}`}
        action={
          <span className="row">
            <Link className="btn secondary" href="/rapor">&larr; Kembali</Link>
            <Link className="btn secondary" href={`/rapor/${params.id}/edit`}>Edit Narasi</Link>
            <a className="btn secondary" href={`/api/dokumen/rapor/${params.id}/dinas`} target="_blank" rel="noreferrer">Rapor Dinas</a>
          </span>
        }
      />
      <p><StatusBadge status={status} /></p>
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card" style={{ marginTop: 10 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Alur Terbit Empat Tahap</h2>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {TAHAP.map(([k, label], i) => (
            <span key={k} className={`badge ${i < idxTahap ? "ok" : i === idxTahap ? "info" : "neutral"}`}>
              {i < idxTahap ? "✓ " : ""}{label}
            </span>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {report.diperiksa_oleh_nama ? <>Diperiksa oleh {String(report.diperiksa_oleh_nama)}. </> : null}
          {report.disetujui_oleh_nama ? <>Disetujui oleh {String(report.disetujui_oleh_nama)} (founder). </> : null}
          Persetujuan akhir laporan periodik adalah hak founder.
        </p>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {aksi?.periksa ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void jalankan("periksa", "Rapor ditandai sudah diperiksa manager.")}>
              {busy ? "Memproses…" : "Tandai Diperiksa Manager"}
            </button>
          ) : null}
          {aksi?.setujui ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void jalankan("setujui", "Rapor disetujui founder.")}>
              {busy ? "Memproses…" : "Setujui sebagai Founder"}
            </button>
          ) : null}
          {aksi?.terbit ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void jalankan("terbit", "Rapor diterbitkan — sekarang tampil untuk orang tua di Balita Connect.")}>
              {busy ? "Memproses…" : "Terbitkan Rapor"}
            </button>
          ) : null}
          {aksi?.kembalikan ? (
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void jalankan("kembalikan", "Rapor dikembalikan ke Draf Guru.")}>
              Kembalikan ke Draf
            </button>
          ) : null}
          {aksi?.tarik ? (
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void jalankan("tarik", "Rapor ditarik kembali ke Draf Guru.")}>
              Tarik ke Draft
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <RaporWeb
          report={report}
          agregat={agregat}
          pdfUrl={terbit ? `/api/dokumen/rapor/${params.id}/pdf` : `/api/dokumen/rapor/${params.id}/pdf?pratinjau=1`}
        />
      </div>
    </>
  );
}
