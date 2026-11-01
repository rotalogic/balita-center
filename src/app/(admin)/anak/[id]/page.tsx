"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Payload = {
  child: Record<string, string | null>;
  guardians: Array<Record<string, string | null>>;
  enrollment: Record<string, string | null> | null;
  reports: Array<{ id: string; report_date: string; status: string; mood: string | null }>;
  health: Array<Record<string, string | null>>;
};

export default function DetailAnakPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/children/${params.id}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  if (error) return (<><PageHead title="Detail Anak Didik" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Detail Anak Didik" /><LoadingState /></>);

  const child = data.child;
  return (
    <>
      <PageHead
        title={String(child.full_name || "Detail Anak Didik")}
        subtitle="Lihat dan kelola informasi lengkap anak didik"
        action={<Link className="btn" href="/daily-reports/buat">+ Daily Report</Link>}
      />
      <section className="grid three">
        <article className="card">
          <h2>Ringkasan</h2>
          <p><StatusBadge status={String(child.status || "aktif")} /></p>
          <dl>
            <dt className="muted">Tanggal lahir</dt><dd>{child.birth_date || "-"}</dd>
            <dt className="muted">Tempat lahir</dt><dd>{child.birth_place || "-"}</dd>
            <dt className="muted">Jenis kelamin</dt><dd>{child.gender || "-"}</dd>
            <dt className="muted">Agama</dt><dd>{child.religion || "-"}</dd>
            <dt className="muted">Tanggal masuk</dt><dd>{child.enrolled_on || "-"}</dd>
          </dl>
        </article>
        <article className="card">
          <h2>Orang Tua / Wali</h2>
          {data.guardians.length === 0 ? (
            <EmptyState title="Belum ada wali" body="Wali utama ditambahkan saat pendaftaran anak." />
          ) : (
            data.guardians.map((g) => (
              <div key={String(g.id)}>
                <strong>{g.full_name}</strong>
                <div className="muted">{g.relation || "Wali"} · {g.phone || "-"}</div>
                <div className="muted">{g.occupation || ""}</div>
              </div>
            ))
          )}
          <h3 style={{ marginTop: 14 }}>Pendidikan</h3>
          {data.enrollment ? (
            <p>{data.enrollment.program_name} · Kelas {data.enrollment.class_name}<br /><span className="muted">Mulai {String(data.enrollment.start_date || "-")}</span></p>
          ) : (<p className="muted">Belum ada pendaftaran aktif.</p>)}
        </article>
        <article className="card">
          <h2>Informasi Kesehatan</h2>
          <dl>
            <dt className="muted">Golongan darah</dt><dd>{child.blood_type || "-"}</dd>
            <dt className="muted">Kebutuhan khusus</dt><dd>{child.special_needs || "Tidak ada"}</dd>
            <dt className="muted">Catatan kesehatan</dt><dd>{child.health_notes || "Tidak ada"}</dd>
          </dl>
          <h3 style={{ marginTop: 12 }}>Pemeriksaan Terakhir</h3>
          {data.health.length === 0 ? (
            <p className="muted">Belum ada pemeriksaan tercatat.</p>
          ) : (
            data.health.slice(0, 2).map((h) => (
              <p key={String(h.id)}>{String(h.checked_on)} · {h.weight_kg || "-"} kg · {h.height_cm || "-"} cm<br /><span className="muted">{h.condition || ""}</span></p>
            ))
          )}
        </article>
      </section>
      <section className="card">
        <h2>Daily Report Terakhir</h2>
        {data.reports.length === 0 ? (
          <EmptyState title="Belum ada laporan" body="Laporan harian anak ini akan tampil di sini setelah guru membuatnya." />
        ) : (
          <ul className="timeline">
            {data.reports.map((r) => (
              <li key={r.id}><time>{new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time><div><strong>{r.status.replace(/_/g, " ")}</strong><div className="muted">Mood: {r.mood || "-"}</div></div></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
