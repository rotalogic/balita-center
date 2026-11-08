"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { RaporWeb, type RaporData } from "@/components/rapor-web";
import type { AgregatRapor } from "@/lib/rapor-data";

export default function ConnectRaporPage() {
  const [report, setReport] = useState<RaporData | null>(null);
  const [agregat, setAgregat] = useState<AgregatRapor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kosong, setKosong] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const childId = params.get("child_id");
    fetch(`/api/connect/rapor${childId ? `?child_id=${childId}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Rapor tidak bisa dimuat."); return; }
        if (!d.report) { setKosong(true); return; }
        setReport(d.report);
        setAgregat(d.agregat);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  if (error) return (<><PageHead title="Rapor Perkembangan" /><ErrorState message={error} /></>);
  if (kosong) {
    return (
      <>
        <PageHead title="Rapor Perkembangan" subtitle="Rapor periodik ananda per siklus belajar" />
        <EmptyState title="Belum ada rapor terbit" body="Rapor tampil di sini setelah guru menyusunnya di akhir siklus dan menerbitkannya. Rapor yang masih draft tidak dibuka untuk orang tua." />
      </>
    );
  }
  if (!report || !agregat) return (<><PageHead title="Rapor Perkembangan" /><LoadingState /></>);

  return (
    <RaporWeb
      report={report}
      agregat={agregat}
      pdfUrl={`/api/dokumen/rapor/${String(report.id)}/pdf`}
    />
  );
}
