"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Report = {
  id: string;
  report_date: string;
  status: string;
  mood: string | null;
  meal_level: string | null;
  child_name: string;
  class_name: string;
  teacher_name: string;
  photo_count: string;
  activity_count: string;
};

export default function DailyReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/daily-reports?status=${encodeURIComponent(status)}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setReports(d.reports) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [status]);

  return (
    <>
      <PageHead
        title="Daily Reports"
        subtitle="Pantau kegiatan, perkembangan, dan keseharian anak didik"
        action={<span className="row"><Link className="btn secondary" href="/daily-reports/review">Review &amp; Approval</Link><Link className="btn" href="/daily-reports/buat">+ Buat Daily Report</Link></span>}
      />
      <div className="toolbar card">
        <label className="field">
          <span className="muted">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status laporan">
            <option value="">Semua</option>
            <option value="draft">Draft</option>
            <option value="menunggu_review">Menunggu Review</option>
            <option value="revisi">Revisi</option>
            <option value="disetujui">Disetujui</option>
            <option value="published">Published</option>
          </select>
        </label>
        {reports ? <span className="muted">{reports.length} laporan</span> : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!reports && !error ? <LoadingState /> : null}
      {reports && reports.length === 0 ? (
        <EmptyState title="Belum ada laporan pada filter ini" body="Guru membuat laporan dari tombol Buat Daily Report. Laporan mulai sebagai draft, dikirim untuk review, lalu diterbitkan ke orang tua." />
      ) : null}
      {reports && reports.length > 0 ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Tanggal</th><th>Anak</th><th>Kelas</th><th>Guru</th><th>Mood</th><th>Makan</th><th>Aktivitas</th><th>Foto</th><th>Status</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td><strong>{r.child_name}</strong></td>
                  <td>{r.class_name}</td>
                  <td>{r.teacher_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.mood || "-"}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.meal_level || "-"}</td>
                  <td>{r.activity_count}</td>
                  <td>{r.photo_count}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
