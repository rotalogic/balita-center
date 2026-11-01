"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Row = Record<string, string | number | null>;
type Payload = {
  child: Row;
  guardians: Row[];
  enrollment: Row | null;
  reports: Array<{ id: string; report_date: string; status: string; mood: string | null }>;
  health: Row[];
  development: Row[];
  milestones: Row[];
};

const TABS = ["Profil Anak", "Pendidikan & STPPA", "Kesehatan", "Laporan & Perkembangan"] as const;
const ASPECTS: Array<[string, string]> = [
  ["physical_pct", "Pertumbuhan Fisik"], ["gross_motor_pct", "Motorik Kasar"], ["fine_motor_pct", "Motorik Halus"],
  ["cognitive_pct", "Kognitif"], ["language_pct", "Bahasa"], ["social_emotional_pct", "Sosial & Emosional"], ["independence_pct", "Kemandirian"],
];

export default function DetailAnakPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profil Anak");

  useEffect(() => {
    fetch(`/api/children/${params.id}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  if (error) return (<><PageHead title="Detail Anak Didik" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Detail Anak Didik" /><LoadingState /></>);

  const child = data.child;
  const dev = data.development[0];

  return (
    <>
      <PageHead
        title={String(child.full_name || "Detail Anak Didik")}
        subtitle="Lihat dan kelola informasi lengkap anak didik"
        action={<Link className="btn" href="/daily-reports/buat">+ Daily Report</Link>}
      />
      <div className="tab-row" role="tablist" aria-label="Bagian detail anak">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "tab-pill active" : "tab-pill"} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Profil Anak" ? (
        <section className="grid three">
          <article className="card">
            <h2>Ringkasan</h2>
            <p><StatusBadge status={String(child.status || "aktif")} /></p>
            <dl>
              <dt className="muted">Tanggal lahir</dt><dd>{String(child.birth_date || "-")}</dd>
              <dt className="muted">Tempat lahir</dt><dd>{String(child.birth_place || "-")}</dd>
              <dt className="muted">Jenis kelamin</dt><dd>{String(child.gender || "-")}</dd>
              <dt className="muted">Agama</dt><dd>{String(child.religion || "-")}</dd>
              <dt className="muted">Bahasa</dt><dd>{String(child.languages || "-")}</dd>
              <dt className="muted">Hobi / minat</dt><dd>{String(child.hobbies || "-")}</dd>
              <dt className="muted">Transportasi</dt><dd>{String(child.transport_mode || "-")}</dd>
              <dt className="muted">Tanggal masuk</dt><dd>{String(child.enrolled_on || "-")}</dd>
            </dl>
          </article>
          <article className="card">
            <h2>Orang Tua / Wali</h2>
            {data.guardians.length === 0 ? (
              <EmptyState title="Belum ada wali" body="Wali utama ditambahkan saat pendaftaran anak." />
            ) : (
              data.guardians.map((g) => (
                <div key={String(g.id)} style={{ marginBottom: 10 }}>
                  <strong>{String(g.full_name)}</strong>
                  <div className="muted">{String(g.relation || "Wali")} · {String(g.phone || "-")}</div>
                  <div className="muted">{String(g.occupation || "")}{g.employer ? ` · ${String(g.employer)}` : ""}</div>
                  <div className="muted">{String(g.address || "")}</div>
                </div>
              ))
            )}
          </article>
          <article className="card">
            <h2>Persetujuan &amp; Catatan</h2>
            <dl>
              <dt className="muted">Izin foto &amp; video</dt><dd>{child.photo_consent ? "Diizinkan" : "Tidak diizinkan"}</dd>
              <dt className="muted">Kebutuhan khusus</dt><dd>{String(child.special_needs || "Tidak ada")}</dd>
              <dt className="muted">Catatan kesehatan / alergi</dt><dd>{String(child.health_notes || "Tidak ada")}</dd>
            </dl>
          </article>
        </section>
      ) : null}

      {tab === "Pendidikan & STPPA" ? (
        <section className="grid two">
          <article className="card">
            <h2>Pendidikan Saat Ini</h2>
            {data.enrollment ? (
              <p>{String(data.enrollment.program_name)} · Kelas {String(data.enrollment.class_name)}<br /><span className="muted">Mulai {String(data.enrollment.start_date || "-")} · Status {String(data.enrollment.status)}</span></p>
            ) : (<EmptyState title="Belum ada pendaftaran aktif" body="Pendaftaran dibuat otomatis saat anak ditambahkan dengan cabang, program, dan kelas." />)}
          </article>
          <article className="card">
            <h2>Milestone</h2>
            {data.milestones.length === 0 ? (
              <EmptyState title="Belum ada milestone tercatat" body="Milestone anak dari tabel student_milestones tampil di sini begitu guru mencatatnya." />
            ) : (
              <ul className="timeline">
                {data.milestones.map((m) => (
                  <li key={String(m.id)}><time>{String(m.achieved_on || "")}</time><div><strong>{String(m.title)}</strong><div className="muted">{String(m.category || "")} · {String(m.notes || "")}</div></div></li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : null}

      {tab === "Kesehatan" ? (
        <section className="grid two">
          <article className="card">
            <h2>Informasi Kesehatan</h2>
            <dl>
              <dt className="muted">Golongan darah</dt><dd>{String(child.blood_type || "-")}</dd>
              <dt className="muted">Kebutuhan khusus</dt><dd>{String(child.special_needs || "Tidak ada")}</dd>
              <dt className="muted">Catatan kesehatan</dt><dd>{String(child.health_notes || "Tidak ada")}</dd>
            </dl>
          </article>
          <article className="card">
            <h2>Riwayat Pemeriksaan</h2>
            {data.health.length === 0 ? (
              <EmptyState title="Belum ada pemeriksaan" body="Pemeriksaan dari tabel health_checks tampil di sini setelah dicatat." />
            ) : (
              <ul className="timeline">
                {data.health.map((h) => (
                  <li key={String(h.id)}><time>{String(h.checked_on)}</time><div>{String(h.condition || "Pemeriksaan rutin")}<div className="muted">{String(h.weight_kg || "-")} kg · {String(h.height_cm || "-")} cm · {String(h.temperature_c || "-")}°C</div></div></li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : null}

      {tab === "Laporan & Perkembangan" ? (
        <section className="grid two">
          <article className="card">
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
          </article>
          <article className="card">
            <h2>Perkembangan Terakhir</h2>
            {!dev ? (
              <EmptyState title="Belum ada catatan perkembangan" body="Catatan per aspek dari tabel child_development_records tampil di sini dan di Balita Connect." />
            ) : (
              <>
                {ASPECTS.map(([key, label]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div className="row spread"><span>{label}</span><strong>{dev[key] ?? "-"}%</strong></div>
                    <div style={{ background: "var(--soft-gray)", borderRadius: 999, height: 8 }}><div style={{ width: `${Number(dev[key] || 0)}%`, background: "var(--teal)", borderRadius: 999, height: 8 }} /></div>
                  </div>
                ))}
                <p className="muted">Periode: {String(dev.recorded_on)}</p>
              </>
            )}
          </article>
        </section>
      ) : null}
    </>
  );
}
