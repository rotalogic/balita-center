"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";

type AnakHariIni = {
  id: string;
  nama: string;
  kelas_nama: string;
  kelompok: string | null;
  absensi: string | null;
  laporan: { id: string; status: string } | null;
};

type DataPortal = {
  tertaut: boolean;
  saya?: { nama: string; posisi: string };
  kelas?: Array<{ id: string; nama: string; kelompok: string | null }>;
  anak_hari_ini?: AnakHariIni[];
  laporan_saya?: {
    draf: number;
    menunggu_review: number;
    terbit: number;
    terbaru: Array<Record<string, unknown>>;
  };
  poin_saya?: {
    periode: string;
    rata_rata: number;
    jumlah_penilaian: number;
    jumlah_penilai: number;
  } | null;
  pengingat?: { laporan_belum_dibuat: number; refleksi_hari_ini: boolean };
};

const BADGE_ABSENSI: Record<string, string> = {
  hadir: "badge ok",
  izin: "badge",
  sakit: "badge warn",
  alpa: "badge warn",
};

export default function PortalGuruPage() {
  const [data, setData] = useState<DataPortal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal-guru")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d as DataPortal) : setError(d.error || "Portal guru tidak dapat dimuat.")))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  if (error) return (<><PageHead title="Portal Guru" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Portal Guru" /><LoadingState /></>);
  if (!data.tertaut) {
    return (
      <>
        <PageHead title="Portal Guru" subtitle="Beranda harian guru: anak dampingan, laporan, dan poin" />
        <EmptyState
          title="Akun Anda belum tertaut ke data staf"
          body="Portal Guru menampilkan kelas dan anak dampingan dari data staf yang terhubung ke akun masuk. Minta pengelola menautkan akun Anda ke data staf di menu SDM, setelah itu halaman ini terisi otomatis."
        />
      </>
    );
  }

  const anak = data.anak_hari_ini || [];
  const lap = data.laporan_saya;

  return (
    <>
      <PageHead
        title={`Selamat datang, ${data.saya?.nama || "Guru"}`}
        subtitle={`${data.saya?.posisi || "Guru"} · kelas dampingan: ${(data.kelas || []).map((k) => k.nama).join(", ") || "belum ada kelas aktif"}`}
      />

      <section className="grid two">
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Anak Dampingan Hari Ini ({anak.length})</h2>
          {anak.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Tidak ada anak tercatat di kelas dampingan Anda untuk hari ini. Daftar membaca
              pendaftaran kelas aktif dan laporan harian, sama seperti roster Absensi.
            </p>
          ) : (
            <ul className="timeline">
              {anak.map((a) => (
                <li key={a.id}>
                  <time>{a.kelompok || a.kelas_nama}</time>
                  <div>
                    <strong><Link href={`/anak/${a.id}`}>{a.nama}</Link></strong>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {a.absensi ? (
                        <span className={BADGE_ABSENSI[a.absensi] || "badge"}>{a.absensi}</span>
                      ) : (
                        <span className="badge">absensi belum diisi</span>
                      )}
                      {a.laporan ? (
                        <Link className="badge ok" href={`/daily-reports/${a.laporan.id}`}>
                          laporan: {a.laporan.status.replace(/_/g, " ")}
                        </Link>
                      ) : a.absensi === "hadir" ? (
                        <Link className="badge warn" href="/daily-reports/buat">laporan belum dibuat</Link>
                      ) : (
                        <span className="badge">tanpa laporan (tidak hadir)</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>Pengingat Sebelum Pulang</h2>
          <ul className="timeline">
            <li>
              <span aria-hidden="true">{data.pengingat?.laporan_belum_dibuat === 0 ? "✓" : "!"}</span>
              <div>
                <strong>Laporan harian anak yang hadir</strong>
                <div className="muted">
                  {data.pengingat?.laporan_belum_dibuat === 0
                    ? "Semua anak hadir hari ini sudah memiliki laporan."
                    : `${data.pengingat?.laporan_belum_dibuat} anak hadir belum dibuatkan laporan hari ini.`}
                </div>
              </div>
            </li>
            <li>
              <span aria-hidden="true">{data.pengingat?.refleksi_hari_ini ? "✓" : "·"}</span>
              <div>
                <strong>Refleksi guru</strong>
                <div className="muted">
                  {data.pengingat?.refleksi_hari_ini
                    ? "Refleksi hari ini sudah ditulis."
                    : "Isi refleksi bila ada peristiwa penting hari ini."}{" "}
                  <Link href="/refleksi">Buka Refleksi</Link>
                </div>
              </div>
            </li>
            <li>
              <span aria-hidden="true">·</span>
              <div>
                <strong>Bahan dan material besok</strong>
                <div className="muted">Siapkan material untuk sesi besok sebelum meninggalkan kelas.</div>
              </div>
            </li>
            <li>
              <span aria-hidden="true">·</span>
              <div>
                <strong>Dokumentasi anak</strong>
                <div className="muted">Unggah foto dokumentasi ke folder anak yang benar; tautan folder ada di kepala berkas anak.</div>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Laporan Saya</h2>
          {lap ? (
            <>
              <p style={{ marginTop: 0 }}>
                Draf {lap.draf} · Menunggu review {lap.menunggu_review} · Terbit {lap.terbit}
              </p>
              {lap.terbaru.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Belum ada laporan atas nama Anda.</p>
              ) : (
                <ul className="timeline">
                  {lap.terbaru.map((r) => (
                    <li key={String(r.id)}>
                      <time>{new Date(String(r.report_date)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time>
                      <div>
                        <strong>{String(r.child_name)}</strong>
                        <div>
                          <span className="badge">{String(r.status).replace(/_/g, " ")}</span>{" "}
                          <Link href={`/daily-reports/${String(r.id)}`}>Buka</Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>Poin Saya</h2>
          {data.poin_saya ? (
            <>
              <div className="kpi-value">{data.poin_saya.rata_rata}</div>
              <p className="muted" style={{ margin: 0 }}>
                Rata-rata penilaian wali periode {data.poin_saya.periode}, dari{" "}
                {data.poin_saya.jumlah_penilaian} penilaian oleh {data.poin_saya.jumlah_penilai}{" "}
                penilai. Nama penilai tidak ditampilkan di sini, sesuai aturan Papan Poin Guru.
              </p>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Belum ada penilaian wali untuk Anda. Poin terisi dari Penilaian Guru oleh Wali
              Murid di Balita Connect, terbaca tanpa nama penilai.
            </p>
          )}
          <p style={{ marginBottom: 0 }}>
            <Link href="/papan-poin">Lihat Papan Poin Guru</Link>
          </p>
        </article>
      </section>
    </>
  );
}
