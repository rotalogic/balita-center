"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { RaporWeb, type RaporData } from "@/components/rapor-web";
import type { AgregatRapor } from "@/lib/rapor-data";

export default function RaporViewPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<RaporData | null>(null);
  const [agregat, setAgregat] = useState<AgregatRapor | null>(null);
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
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function ubahStatus(publish: boolean) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/rapor/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publish ? { publish: true } : { unpublish: true }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) {
      setInfo(publish ? "Rapor diterbitkan — sekarang tampil untuk orang tua di Balita Connect." : "Rapor ditarik kembali ke draft.");
      load();
    } else {
      setError(d.error || "Gagal mengubah status rapor.");
    }
  }

  if (error && !report) {
    return (<><PageHead title="Rapor Perkembangan" /><ErrorState message={error} />
      <p style={{ marginTop: 12 }}><Link className="btn secondary" href="/rapor">&larr; Kembali ke daftar</Link></p></>);
  }
  if (!report || !agregat) return (<><PageHead title="Rapor Perkembangan" /><LoadingState /></>);

  const terbit = report.status === "published";

  return (
    <>
      <PageHead
        title="Rapor Perkembangan"
        subtitle={`${String(report.child_name)} · ${String(report.cycle_theme)}`}
        action={
          <span className="row">
            <Link className="btn secondary" href="/rapor">&larr; Kembali</Link>
            <Link className="btn secondary" href={`/rapor/${params.id}/edit`}>Edit Narasi</Link>
            {terbit ? (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => ubahStatus(false)}>{busy ? "Memproses…" : "Tarik ke Draft"}</button>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => ubahStatus(true)}>{busy ? "Memproses…" : "Terbitkan"}</button>
            )}
          </span>
        }
      />
      <p><StatusBadge status={String(report.status)} /></p>
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div style={{ marginTop: 14 }}>
        <RaporWeb
          report={report}
          agregat={agregat}
          pdfUrl={terbit ? `/api/dokumen/rapor/${params.id}/pdf` : null}
        />
      </div>
    </>
  );
}
