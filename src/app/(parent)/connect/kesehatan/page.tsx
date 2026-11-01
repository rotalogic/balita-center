"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectKesehatanPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Kesehatan Anak" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Kesehatan Anak" /><LoadingState /></>);
  const latest = data.health[0];
  return (
    <>
      <PageHead title="Kesehatan Anak" subtitle="Pantau riwayat kesehatan, imunisasi, dan kondisi fisik anak" />
      {!latest ? (
        <EmptyState title="Belum ada pemeriksaan kesehatan" body="Pemeriksaan berkala (suhu, berat, tinggi, kondisi) tampil di sini setelah dicatat guru atau petugas kesehatan di tabel health_checks." />
      ) : (
        <>
          <section className="grid kpi">
            <article className="card kpi-card"><div className="kpi-label">Suhu Tubuh</div><div className="kpi-value">{latest.temperature_c || "-"}°C</div></article>
            <article className="card kpi-card"><div className="kpi-label">Detak Jantung</div><div className="kpi-value">{latest.heart_rate_bpm || "-"} bpm</div></article>
            <article className="card kpi-card"><div className="kpi-label">Berat Badan</div><div className="kpi-value">{latest.weight_kg || "-"} kg</div></article>
            <article className="card kpi-card"><div className="kpi-label">Tinggi Badan</div><div className="kpi-value">{latest.height_cm || "-"} cm</div></article>
          </section>
          <article className="card">
            <h2>Status Kesehatan Saat Ini</h2>
            <p><strong>{latest.condition || "Dalam kondisi baik"}</strong></p>
            <p className="muted">{latest.notes || ""} Terakhir diperbarui: {String(latest.checked_on)}</p>
          </article>
          <article className="card">
            <h2>Riwayat Pemeriksaan</h2>
            <ul className="timeline">
              {data.health.map((h) => (
                <li key={String(h.id)}><time>{String(h.checked_on)}</time><div>{h.condition || "Pemeriksaan rutin"}<div className="muted">{h.weight_kg || "-"} kg · {h.height_cm || "-"} cm</div></div></li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>Informasi Kesehatan Dasar</h2>
            <p>Golongan darah: <strong>{data.child?.blood_type || "-"}</strong><br />
            Catatan kesehatan: {data.child?.health_notes || "Tidak ada"}<br />
            Kebutuhan khusus: {data.child?.special_needs || "Tidak ada"}</p>
          </article>
        </>
      )}
    </>
  );
}
