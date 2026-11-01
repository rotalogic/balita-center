"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Report = {
  id: string; report_date: string; status: string; mood: string | null; meal_level: string | null;
  child_name: string; class_name: string; teacher_name: string; photo_count: string; activity_count: string;
};

const TABS: Array<[string, string]> = [
  ["", "Semua"], ["draft", "Draft"], ["menunggu_review", "Menunggu Review"],
  ["disetujui", "Disetujui"], ["revisi", "Revisi"], ["published", "Terbit"],
];

function exportCsv(reports: Report[]) {
  const esc = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["tanggal,anak,kelas,guru,mood,makan,aktivitas,foto,status"];
  for (const r of reports) {
    lines.push([r.report_date, r.child_name, r.class_name, r.teacher_name, r.mood, r.meal_level, r.activity_count, r.photo_count, r.status].map(esc).join(","));
  }
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daily-reports.csv";
  a.click();
  URL.revokeObjectURL(url);
}

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
        action={<span className="row"><button type="button" className="btn secondary" disabled={!reports || reports.length === 0} onClick={() => reports && exportCsv(reports)}>⬇ Ekspor Semua (CSV)</button><Link className="btn secondary" href="/daily-reports/review">Review &amp; Approval</Link><Link className="btn" href="/daily-reports/buat">+ Buat Daily Report</Link></span>}
      />
      <div className="toolbar card">
        <div className="tab-row" role="group" aria-label="Filter status laporan">
          {TABS.map(([value, label]) => (
            <button key={value || "semua"} type="button" className={status === value ? "tab-pill active" : "tab-pill"} onClick={() => setStatus(value)} aria-pressed={status === value}>{label}</button>
          ))}
        </div>
        {reports ? <span className="muted">{reports.length} laporan</span> : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!reports && !error ? <LoadingState /> : null}
      {reports && reports.length === 0 ? (
        <EmptyState title="Belum ada laporan pada tab ini" body="Guru membuat laporan dari tombol Buat Daily Report. Laporan mulai sebagai draft, dikirim untuk review, lalu diterbitkan ke orang tua." />
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
