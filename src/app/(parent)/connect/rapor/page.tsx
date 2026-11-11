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
  const [tanggapan, setTanggapan] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        setTanggapan(String(d.report.tanggapan_ortu || ""));
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  async function kirimTanggapan() {
    setBusy(true);
    setInfo(null);
    setError(null);
    const res = await fetch("/api/connect/rapor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: report?.child_id, tanggapan }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error || "Tanggapan gagal terkirim."); return; }
    setInfo("Terima kasih — tanggapan Anda tercatat pada rapor ananda.");
    setReport((p) => (p ? { ...p, tanggapan_ortu: tanggapan, tanggapan_at: new Date().toISOString() } : p));
  }

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
    <>
      <RaporWeb
        report={report}
        agregat={agregat}
        pdfUrl={`/api/dokumen/rapor/${String(report.id)}/pdf`}
      />
      <div className="card" style={{ maxWidth: 880, margin: "18px auto 0" }}>
        <h2 style={{ marginTop: 0 }}>Tanggapan &amp; Masukan Orang Tua</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tanggapan Anda menjadi bagian dari rapor ananda dan dibaca guru kelas.
        </p>
        {info ? <p className="success" role="status">{info}</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="field">
          <label htmlFor="tanggapan_ortu">Tanggapan Anda atas rapor ini</label>
          <textarea id="tanggapan_ortu" rows={4} value={tanggapan} onChange={(e) => setTanggapan(e.target.value)}
            placeholder="Tulis tanggapan, kesan, atau hal yang ingin didiskusikan dengan guru…" />
        </div>
        <button className="btn" type="button" disabled={busy || tanggapan.trim().length < 3} style={{ marginTop: 10 }}
          onClick={() => void kirimTanggapan()}>
          {busy ? "Mengirim…" : "Kirim Tanggapan"}
        </button>
      </div>
    </>
  );
}
