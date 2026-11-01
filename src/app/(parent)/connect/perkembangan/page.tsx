"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

const ASPECTS: Array<[string, string]> = [
  ["physical_pct", "Pertumbuhan Fisik"],
  ["gross_motor_pct", "Motorik Kasar"],
  ["fine_motor_pct", "Motorik Halus"],
  ["cognitive_pct", "Kognitif"],
  ["language_pct", "Bahasa"],
  ["social_emotional_pct", "Sosial & Emosional"],
  ["independence_pct", "Kemandirian"],
];

export default function ConnectPerkembanganPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Perkembangan Anak" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Perkembangan Anak" /><LoadingState /></>);
  const latest = data.development[0];
  return (
    <>
      <PageHead title="Perkembangan Anak" subtitle="Pantau tumbuh kembang anak melalui data, observasi, dan catatan guru" />
      {!latest ? (
        <EmptyState title="Belum ada catatan perkembangan" body="Catatan perkembangan per aspek (fisik, motorik, kognitif, bahasa, sosial-emosional, kemandirian) tampil setelah guru mengisinya pada tabel child_development_records." />
      ) : (
        <>
          <section className="grid three">
            {ASPECTS.map(([key, label]) => (
              <article className="card" key={key}>
                <div className="kpi-label">{label}</div>
                <div className="kpi-value">{latest[key] ?? "-"}%</div>
                <div style={{ background: "var(--soft-gray)", borderRadius: 999, height: 8, marginTop: 8 }}>
                  <div style={{ width: `${Number(latest[key] || 0)}%`, background: "var(--teal)", borderRadius: 999, height: 8 }} />
                </div>
              </article>
            ))}
          </section>
          <article className="card">
            <h2>Catatan Guru</h2>
            <p>{latest.teacher_notes || "Tidak ada catatan pada periode ini."}</p>
            <h3>Rekomendasi untuk Orang Tua</h3>
            <p>{latest.parent_recommendations || "Tidak ada rekomendasi khusus pada periode ini."}</p>
            <p className="muted">Periode: {String(latest.recorded_on)}</p>
          </article>
        </>
      )}
    </>
  );
}
