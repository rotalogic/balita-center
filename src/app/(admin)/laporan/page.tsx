"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import { ApiError, KpiGrid, useApi } from "@/components/module-ui";

type Mods = { attendanceToday: { hadir: number; total: number } };
type Counts = { counts: Record<string, number> };

export default function LaporanPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=daily_reports,cycle_reports,child_attendance,audit_logs");
  const stats = useApi<{ stats: { pendingReports: number; invoicesOpen: number } }>("/api/stats");
  const error = mods.error || counts.error || stats.error;

  return (
    <>
      <PageHead title="Laporan" subtitle="Laporan eksekutif, akademik, kehadiran, keuangan, dan SDM" action={<Link className="btn secondary" href="/daily-reports">Buka Daily Reports</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Total Laporan Harian", value: counts.data ? counts.data.counts.daily_reports : "...", icon: "✓", tone: "tone-sage" },
        { label: "Menunggu Review", value: stats.data ? stats.data.stats.pendingReports : "...", icon: "✎", tone: "tone-peach" },
        { label: "Laporan Siklus (Rapor)", value: counts.data ? counts.data.counts.cycle_reports : "...", icon: "▤", tone: "tone-sky" },
        { label: "Jejak Audit Tercatat", value: counts.data ? counts.data.counts.audit_logs : "...", icon: "⚙", tone: "tone-lavender" },
      ]} />
      <section className="grid two">
        <article className="card">
          <h2>Kehadiran Anak Hari Ini</h2>
          {mods.data ? (
            <p style={{ fontSize: 17 }}><strong>{mods.data.attendanceToday.hadir}</strong> hadir dari <strong>{mods.data.attendanceToday.total}</strong> catatan kehadiran hari ini.</p>
          ) : null}
          <p className="muted">Dihitung dari tabel child_attendance untuk tanggal hari ini. Belum ada catatan berarti guru belum mengisi absensi hari ini.</p>
        </article>
        <article className="card">
          <h2>Ekspor &amp; Tindak Lanjut</h2>
          <p className="muted">Daftar laporan harian bisa diekspor ke CSV dari halaman Daily Reports. Laporan investor tersedia agregat di halaman Investor tanpa data anak teridentifikasi.</p>
          <div className="row">
            <Link className="btn secondary" href="/daily-reports">Ekspor CSV Laporan</Link>
            <Link className="btn secondary" href="/investor">Dashboard Investor</Link>
          </div>
        </article>
      </section>
    </>
  );
}
