"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectLaporanPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Detail Daily Report" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Detail Daily Report" /><LoadingState /></>);
  if (!data.child || !data.report) {
    return (
      <>
        <PageHead title="Detail Daily Report" subtitle="Lihat kegiatan, perkembangan, dan kondisi anak hari ini" />
        <EmptyState title="Belum ada laporan terbit" body="Daily report tampil di sini setelah guru membuatnya dan reviewer menerbitkannya. Laporan draft atau yang masih direview tidak dibuka untuk orang tua." />
      </>
    );
  }
  const r = data.report;
  return (
    <>
      <PageHead title="Detail Daily Report" subtitle={`${data.child.full_name} · ${String(r.report_date)}`} />
      <section className="grid kpi">
        <article className="card kpi-card"><div className="kpi-label">Makan</div><div className="kpi-value" style={{ textTransform: "capitalize", fontSize: 20 }}>{r.meal_level || "-"}</div><p className="muted">{r.meals_text || ""}</p></article>
        <article className="card kpi-card"><div className="kpi-label">Tidur</div><div className="kpi-value" style={{ textTransform: "capitalize", fontSize: 20 }}>{r.nap_quality || "-"}</div><p className="muted">{r.nap_start || ""} - {r.nap_end || ""}</p></article>
        <article className="card kpi-card"><div className="kpi-label">Toilet</div><div className="kpi-value" style={{ fontSize: 20 }}>{r.toilet_pee_count || "0"}x pipis · {r.toilet_poop_count || "0"}x BAB</div></article>
        <article className="card kpi-card"><div className="kpi-label">Mood</div><div className="kpi-value" style={{ textTransform: "capitalize", fontSize: 20 }}>{r.mood || "-"}</div><p className="muted">{r.mood_notes || ""}</p></article>
      </section>
      <section className="grid two">
        <article className="card">
          <h2>Timeline Aktivitas</h2>
          {data.activities.length === 0 ? (
            <EmptyState title="Tidak ada aktivitas tercatat" body="Aktivitas laporan terbit ini belum diisi guru." />
          ) : (
            <ul className="timeline">
              {data.activities.map((a) => (
                <li key={String(a.id)}>
                  <time>{String(a.activity_time || "").slice(0, 5) || "--:--"}</time>
                  <div><strong>{a.title}</strong><div className="muted">{a.apparatus || ""}{a.notes ? ` · ${a.notes}` : ""}</div></div>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <h2>Catatan Guru</h2>
          <p>{r.notes || "Tidak ada catatan tambahan pada laporan ini."}</p>
          <h3>Kesehatan Hari Ini</h3>
          <p className="muted">Detail pemeriksaan tersedia di halaman Kesehatan.</p>
        </article>
      </section>
    </>
  );
}
