"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";

type Stats = {
  children: number;
  staff: number;
  branches: number;
  revenueMonth: number;
  pendingReports: number;
  invoicesOpen: number;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => (data.ok ? setStats(data.stats) : setError(data.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

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
            <article className="card kpi-card">
              <div className="kpi-icon tone-sky" aria-hidden="true">☺</div>
              <div className="kpi-label">Total Anak Didik</div>
              <div className="kpi-value">{stats.children}</div>
            </article>
            <article className="card kpi-card">
              <div className="kpi-icon tone-pink" aria-hidden="true">⚑</div>
              <div className="kpi-label">Guru &amp; Staf</div>
              <div className="kpi-value">{stats.staff}</div>
            </article>
            <article className="card kpi-card">
              <div className="kpi-icon tone-sage" aria-hidden="true">▦</div>
              <div className="kpi-label">Pendapatan Bulan Ini (Buku Kas)</div>
              <div className="kpi-value">{rupiah(stats.revenueMonth)}</div>
            </article>
            <article className="card kpi-card">
              <div className="kpi-icon tone-peach" aria-hidden="true">⌂</div>
              <div className="kpi-label">Cabang Aktif</div>
              <div className="kpi-value">{stats.branches}</div>
            </article>
          </section>

          <section className="grid two">
            <article className="card">
              <h2>Notifikasi &amp; Persetujuan</h2>
              {stats.pendingReports === 0 && stats.invoicesOpen === 0 ? (
                <EmptyState title="Tidak ada yang menunggu" body="Laporan yang menunggu review dan tagihan terbuka akan muncul di sini, dihitung langsung dari database." />
              ) : (
                <ul className="timeline">
                  <li><span aria-hidden="true">✓</span><div><strong>{stats.pendingReports} laporan harian</strong><div className="muted">menunggu review. <Link href="/daily-reports/review">Buka Review &amp; Approval</Link></div></div></li>
                  <li><span aria-hidden="true">▦</span><div><strong>{stats.invoicesOpen} tagihan</strong><div className="muted">belum lunas atau menunggu konfirmasi pembayaran.</div></div></li>
                </ul>
              )}
            </article>
            <article className="card">
              <h2>Mulai dari Database Kosong</h2>
              <p className="muted">Paket ini sengaja tidak membawa data contoh. Urutan isi pertama:</p>
              <ol>
                <li>Buat cabang, program, kelas, dan staf lewat formulir Data Awal di halaman Tambah Anak.</li>
                <li>Tambahkan anak didik beserta wali dan pendaftarannya.</li>
                <li>Buat laporan harian, kirim untuk review, lalu terbitkan ke Balita Connect.</li>
              </ol>
              <div className="row">
                <Link className="btn secondary" href="/anak/tambah">Buka Data Awal</Link>
                <Link className="btn secondary" href="/connect">Lihat Balita Connect</Link>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
