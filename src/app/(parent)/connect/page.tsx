"use client";

import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { childAgeLabel, useConnect } from "@/lib/use-connect";

export default function ConnectDashboardPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Balita Connect" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Balita Connect" /><LoadingState /></>);
  if (!data.child) {
    return (
      <>
        <PageHead title="Balita Connect" subtitle="Portal orang tua" />
        <EmptyState title="Belum ada data anak" body="Portal orang tua menampilkan anak setelah data anak didik dibuat di sisi admin. Tambahkan anak pertama lewat menu Anak Didik." />
      </>
    );
  }
  const child = data.child;
  return (
    <>
      <PageHead title={`Halo, Orang Tua ${String(child.nickname || child.full_name)}`} subtitle="Balita Connect: kabar terbaru anak Anda dari sekolah" />
      <section className="grid two">
        <article className="card">
          <h2>Profil Anak</h2>
          <p><strong style={{ fontSize: 17 }}>{child.full_name}</strong> <span className="badge ok">Aktif</span></p>
          <p className="muted">{childAgeLabel(child.birth_date)} · Golongan darah {child.blood_type || "-"}</p>
          <div className="row">
            <Link className="btn small secondary" href="/connect/laporan">Daily Report Terbaru</Link>
            <Link className="btn small secondary" href="/connect/kesehatan">Kesehatan Anak</Link>
          </div>
        </article>
        <article className="card">
          <h2>Kabar Terbaru</h2>
          <ul className="timeline">
            <li><span aria-hidden="true">✉</span><div><strong>{data.messages.length} pesan</strong><div className="muted">tercatat untuk anak ini. <Link href="/connect/pesan">Buka Pesan</Link></div></div></li>
            <li><span aria-hidden="true">▦</span><div><strong>{data.events.length} kegiatan</strong><div className="muted">terjadwal di sekitar minggu ini. <Link href="/connect/kegiatan">Lihat Kegiatan</Link></div></div></li>
            <li><span aria-hidden="true">✓</span><div><strong>{data.report ? "Daily report terbit tersedia" : "Belum ada daily report terbit"}</strong><div className="muted">{data.report ? String(data.report.report_date) : "Laporan tampil setelah diterbitkan guru dan reviewer."}</div></div></li>
          </ul>
        </article>
      </section>
      <article className="card">
        <h2>Butuh bantuan?</h2>
        <p className="muted">Hubungi kami melalui WhatsApp sekolah dari halaman Pesan, atau sampaikan lewat guru kelas anak Anda.</p>
        <Link className="btn" href="/connect/pesan">Chat Sekarang</Link>
      </article>
    </>
  );
}
