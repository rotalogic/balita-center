"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DataPendiri = {
  tampil: boolean;
  anak?: { total: number; per_kategori: Array<{ kategori: string; jumlah: number }>; trial: number };
  antrean_trial?: {
    total: number;
    per_tahap: Array<{ tahap: string; jumlah: number }>;
    daftar_tunggu_sesi: number;
  };
  laporan_bulan_ini?: { terbit: number; draf: number; proses: number };
  rujukan?: { aktif: number; menunggu_terbit: number };
  tunggakan?: { tagihan: number; total: number; lewat_jatuh_tempo: number };
  masukan_terbaru?: Array<Record<string, unknown>>;
  surat_terbit_7_hari?: number;
  kalender_terdekat?: Array<Record<string, unknown>>;
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

// Pandangan pendiri di Dashboard (Tur Demo Layar 1). Komponen ini diam
// untuk peran selain pendiri/super admin: API yang memutuskan tampil,
// bukan penyembunyian tombol.
export function DasborPendiri() {
  const [data, setData] = useState<DataPendiri | null>(null);

  useEffect(() => {
    fetch("/api/dashboard-pendiri")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d as DataPendiri) : setData({ tampil: false })))
      .catch(() => setData({ tampil: false }));
  }, []);

  if (!data || !data.tampil) return null;
  const lap = data.laporan_bulan_ini;
  const totalLaporan = lap ? lap.terbit + lap.draf + lap.proses : 0;

  return (
    <section aria-label="Pandangan Pendiri" style={{ marginTop: 16 }}>
      <article className="card">
        <div className="row spread">
          <h2 style={{ margin: 0 }}>Pandangan Pendiri</h2>
          <span className="muted">Satu pandangan pagi: anak, antrean, laporan, rujukan, keuangan</span>
        </div>
        <div className="grid kpi" style={{ marginTop: 12 }}>
          <div className="card kpi-card">
            <div className="kpi-label">Anak Aktif</div>
            <div className="kpi-value">{data.anak?.total ?? 0}</div>
            <div className="muted">
              {(data.anak?.per_kategori || []).map((k) => `${k.kategori} ${k.jumlah}`).join(" · ")}
              {data.anak?.trial ? ` · ${data.anak.trial} berlabel Trial` : ""}
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Antrean Penerimaan</div>
            <div className="kpi-value">{data.antrean_trial?.total ?? 0}</div>
            <div className="muted">
              keluarga di pipa penerimaan
              {data.antrean_trial?.daftar_tunggu_sesi
                ? ` · ${data.antrean_trial.daftar_tunggu_sesi} di daftar tunggu sesi`
                : ""}
              . <Link href="/admission">Buka Admission</Link>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Status Laporan Bulan Ini</div>
            <div className="kpi-value">
              {lap?.terbit ?? 0}
              <span className="muted" style={{ fontSize: 14 }}> / {totalLaporan} terbit</span>
            </div>
            <div className="muted">
              Draf guru {lap?.draf ?? 0} · dalam proses {lap?.proses ?? 0}.{" "}
              <Link href="/daily-reports">Buka Daily Reports</Link>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Rujukan Aktif</div>
            <div className="kpi-value">{data.rujukan?.aktif ?? 0}</div>
            <div className="muted">
              {data.rujukan?.menunggu_terbit
                ? `${data.rujukan.menunggu_terbit} berkas menunggu persetujuan terbit. `
                : ""}
              <Link href="/skrining">Buka Skrining &amp; Rujukan</Link>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Tunggakan</div>
            <div className="kpi-value">{rupiah(data.tunggakan?.total ?? 0)}</div>
            <div className="muted">
              {data.tunggakan?.tagihan ?? 0} tagihan terbuka
              {data.tunggakan?.lewat_jatuh_tempo
                ? `, ${data.tunggakan.lewat_jatuh_tempo} lewat jatuh tempo`
                : ""}
              . <Link href="/keuangan">Buka Keuangan</Link>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Surat Terbit (7 hari)</div>
            <div className="kpi-value">{data.surat_terbit_7_hari ?? 0}</div>
            <div className="muted">
              <Link href="/surat">Buka Surat &amp; Proposal</Link>
            </div>
          </div>
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Masukan Orang Tua Terbaru</h3>
            {(data.masukan_terbaru || []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Belum ada masukan orang tua tercatat.</p>
            ) : (
              <ul className="timeline">
                {(data.masukan_terbaru || []).map((m, i) => (
                  <li key={i}>
                    <time>{new Date(String(m.created_at)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time>
                    <div>
                      <strong>{String(m.child_name || "Keluarga")}</strong>
                      <div className="muted">
                        {String(m.aspek || "Masukan")} · status {String(m.status || "").replace(/_/g, " ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}><Link href="/masukan">Buka Masukan Orang Tua</Link></p>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Kalender Terdekat</h3>
            {(data.kalender_terdekat || []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Belum ada entri kalender mendatang.</p>
            ) : (
              <ul className="timeline">
                {(data.kalender_terdekat || []).map((k, i) => (
                  <li key={i}>
                    <time>{new Date(`${String(k.tanggal)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time>
                    <div>
                      <strong>{String(k.judul)}</strong>
                      <div className="muted">Lapis {String(k.lapis || "lembaga")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}><Link href="/kalender">Buka Kalender</Link></p>
          </div>
        </div>
      </article>
    </section>
  );
}
