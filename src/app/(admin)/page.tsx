"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Stats = { children: number; staff: number; branches: number; revenueMonth: number; pendingReports: number; invoicesOpen: number };
type Dash = {
  recentChildren: Array<{ id: string; full_name: string; created_at: string }>;
  recentReports: Array<{ id: string; report_date: string; status: string; child_name: string }>;
  todayEvents: Array<{ id: string; title: string; category: string; location: string | null; start_time: string | null; end_time: string | null }>;
  weekReports: Array<{ day: string; n: number }>;
  pendingLeaves: number;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then((d) => (d.ok ? setStats(d.stats) : setError(d.error))).catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/dashboard").then((r) => r.json()).then((d) => (d.ok ? setDash(d) : null)).catch(() => null);
  }, []);

  const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const maxBar = dash ? Math.max(1, ...dash.weekReports.map((w) => w.n)) : 1;

  return (
    <>
      <PageHead
        title="Selamat pagi, Wildan"
        subtitle={`Mari terus menciptakan lingkungan terbaik untuk tumbuh kembang anak. ${today}.`}
        action={<Link className="btn" href="/anak/tambah">+ Tambah Anak</Link>}
      />
      {error ? <ErrorState message={error} /> : null}
      {!stats && !error ? <LoadingState /> : null}
      {stats ? (
        <>
          <section className="grid kpi" aria-label="Ringkasan">
            <article className="card kpi-card"><div className="kpi-icon tone-sky" aria-hidden="true">☺</div><div className="kpi-label">Total Anak Didik</div><div className="kpi-value">{stats.children}</div></article>
            <article className="card kpi-card"><div className="kpi-icon tone-pink" aria-hidden="true">⚑</div><div className="kpi-label">Guru &amp; Staf</div><div className="kpi-value">{stats.staff}</div></article>
            <article className="card kpi-card"><div className="kpi-icon tone-sage" aria-hidden="true">▦</div><div className="kpi-label">Pendapatan Bulan Ini (Buku Kas)</div><div className="kpi-value">{rupiah(stats.revenueMonth)}</div></article>
            <article className="card kpi-card"><div className="kpi-icon tone-peach" aria-hidden="true">⌂</div><div className="kpi-label">Cabang Aktif</div><div className="kpi-value">{stats.branches}</div></article>
          </section>

          <section className="grid two">
            <article className="card">
              <h2>Laporan Harian 7 Hari Terakhir</h2>
              {!dash ? <LoadingState label="Memuat grafik..." /> : dash.weekReports.every((w) => w.n === 0) ? (
                <EmptyState title="Belum ada laporan minggu ini" body="Grafik ini menghitung laporan harian per tanggal dari database; garis akan naik begitu guru membuat laporan." />
              ) : (
                <div className="bars" role="img" aria-label="Grafik jumlah laporan harian 7 hari terakhir">
                  {dash.weekReports.map((w) => (
                    <div className="bar-col" key={w.day}>
                      <strong>{w.n}</strong>
                      <div className="bar" style={{ height: `${Math.round((w.n / maxBar) * 90)}px` }} />
                      <span className="bar-label">{w.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="card">
              <h2>Jadwal Hari Ini</h2>
              {!dash ? <LoadingState label="Memuat jadwal..." /> : dash.todayEvents.length === 0 ? (
                <EmptyState title="Tidak ada kegiatan hari ini" body="Kegiatan yang ditambahkan ke tabel school_events dengan tanggal hari ini akan tampil di sini dan di Balita Connect." />
              ) : (
                <ul className="timeline">
                  {dash.todayEvents.map((e) => (
                    <li key={e.id}><time>{e.start_time ? e.start_time.slice(0, 5) : "--:--"}</time><div><strong>{e.title}</strong><div className="muted">{e.category} · {e.location || ""}</div></div></li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="grid two">
            <article className="card">
              <h2>Notifikasi &amp; Persetujuan</h2>
              {stats.pendingReports === 0 && stats.invoicesOpen === 0 && (!dash || dash.pendingLeaves === 0) ? (
                <EmptyState title="Tidak ada yang menunggu" body="Laporan menunggu review, tagihan terbuka, dan cuti menunggu persetujuan akan muncul di sini, dihitung langsung dari database." />
              ) : (
                <ul className="timeline">
                  <li><span aria-hidden="true">✓</span><div><strong>{stats.pendingReports} laporan harian</strong><div className="muted">menunggu review. <Link href="/daily-reports/review">Buka Review &amp; Approval</Link></div></div></li>
                  <li><span aria-hidden="true">▦</span><div><strong>{stats.invoicesOpen} tagihan</strong><div className="muted">belum lunas atau menunggu konfirmasi. <Link href="/keuangan">Buka Keuangan</Link></div></div></li>
                  <li><span aria-hidden="true">⚑</span><div><strong>{dash?.pendingLeaves ?? 0} permintaan cuti</strong><div className="muted">menunggu persetujuan. <Link href="/sdm">Buka SDM</Link></div></div></li>
                </ul>
              )}
            </article>
            <article className="card">
              <h2>Aktivitas Terbaru</h2>
              {!dash ? <LoadingState label="Memuat aktivitas..." /> : dash.recentChildren.length === 0 && dash.recentReports.length === 0 ? (
                <EmptyState title="Belum ada aktivitas" body="Anak yang baru ditambahkan dan laporan terbaru akan tampil di sini. Mulai dari Data Awal di halaman Tambah Anak." />
              ) : (
                <ul className="timeline">
                  {dash.recentReports.map((r) => (
                    <li key={`r-${r.id}`}><span aria-hidden="true">✓</span><div><strong>Laporan {r.child_name}</strong> <StatusBadge status={r.status} /><div className="muted">{new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div></div></li>
                  ))}
                  {dash.recentChildren.map((c) => (
                    <li key={`c-${c.id}`}><span aria-hidden="true">☺</span><div><strong>Anak baru: {c.full_name}</strong><div className="muted"><Link href={`/anak/${c.id}`}>Lihat detail</Link></div></div></li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
