// Tampilan rapor periodik sebagai halaman web, meniru rapor portal lama:
// judul bagian marun dengan garis bawah, kartu narasi berbingkai, kotak
// Kesimpulan/Saran krem berpalang emas, grid Dokumentasi Kegiatan, dan dua
// panel Ringkasan Kehadiran & Tumbuh Kembang. Dipakai bersama oleh tampilan
// staf dan Balita Connect; PDF (src/lib/pdf/rapor.ts) mengikuti susunan ini.
// Semua label di sini manusiawi — kode mentah database tidak tampil.

import { NARASI_MONTESSORI, NARASI_STPPA, labelGizi, type AgregatRapor } from "@/lib/rapor-data";

export type RaporData = Record<string, string | number | null | undefined>;

function formatTanggal(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}

function angka(v: string | number | null | undefined, satuan: string): string {
  if (v === null || v === undefined || v === "") return `- ${satuan}`;
  const n = Number(v);
  const teks = Number.isNaN(n) ? String(v) : n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return `${teks} ${satuan}`;
}

function GayaRapor() {
  return (
    <style>{`
      .rap { max-width: 880px; margin: 0 auto; color: #232a31; font-size: 15px; line-height: 1.6; }
      .rap * { box-sizing: border-box; }
      .rap-kepala { background: linear-gradient(120deg, #fdf3e7, #fdf9ef); border: 1px solid #f0e3cd; border-radius: 18px; padding: 20px 22px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
      .rap-kepala .kecil { color: #8a5a12; font-weight: 700; font-size: 12.5px; letter-spacing: .12em; }
      .rap-kepala .nama { font-size: 22px; font-weight: 800; color: #14181d; line-height: 1.25; }
      .rap-kepala .sub { color: #5b6b7a; font-size: 13.5px; margin-top: 2px; }
      .rap-kanan { margin-left: auto; }
      .rap-pil { display: inline-flex; align-items: center; gap: 7px; background: #fff; border: 1px solid #e5d9bd; color: #7a4d0e; font-weight: 700; font-size: 13.5px; padding: 8px 15px; border-radius: 999px; text-decoration: none; box-shadow: 0 1px 2px rgba(90,63,10,.06); }
      a.rap-pil:hover { background: #fdf6e3; }
      .rap-seksi { margin-top: 28px; }
      .rap-seksi > h2 { font-size: 17px; font-weight: 800; color: #7a1f3d; margin: 0 0 4px; padding-bottom: 7px; border-bottom: 1px solid #e8dde2; }
      .rap-kartu { background: #fff; border: 1px solid #e3e7ec; border-radius: 10px; padding: 14px 18px; margin-top: 12px; }
      .rap-kartu .judul { font-weight: 700; font-size: 15px; color: #191d22; }
      .rap-kartu p { margin: 5px 0 0; color: #3c454e; font-size: 14.5px; }
      .rap-krem { background: #fdfbf1; border-left: 4px solid #d9a92c; border-radius: 6px; padding: 14px 18px; margin-top: 12px; color: #2f353c; font-size: 14.5px; }
      .rap-foto { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
      @media (max-width: 640px) { .rap-foto { grid-template-columns: repeat(2, 1fr); } .rap-grid2 { grid-template-columns: 1fr !important; } }
      .rap-foto figure { margin: 0; background: #faf7f2; border-radius: 10px; overflow: hidden; }
      .rap-foto img { width: 100%; height: 170px; object-fit: cover; display: block; }
      .rap-foto figcaption { font-size: 12px; color: #77828e; padding: 6px 10px; }
      .rap-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
      .rap-panel { background: #faf7f2; border-radius: 12px; padding: 16px 18px; }
      .rap-panel h3 { margin: 0 0 8px; font-size: 13px; letter-spacing: .06em; color: #7a1f3d; font-weight: 800; }
      .rap-baris { display: flex; justify-content: space-between; gap: 14px; padding: 4.5px 0; font-size: 14px; }
      .rap-baris .k { color: #4a545e; }
      .rap-baris .v { font-weight: 700; color: #191d22; text-align: right; }
      .rap-panel .garis { border-top: 1px solid #e9e2d4; margin: 7px 0; }
      .rap-panel .kaki { font-size: 12px; color: #8a94a0; margin-top: 8px; line-height: 1.5; }
      .rap-kaki { margin-top: 30px; padding-top: 14px; border-top: 1px solid #edf0f3; color: #5b656f; font-size: 13.5px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .rap-ava { width: 34px; height: 34px; border-radius: 50%; background: #e8ebee; color: #5b656f; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex: none; }
    `}</style>
  );
}

export function RaporWeb({
  report,
  agregat,
  pdfUrl,
}: {
  report: RaporData;
  agregat: AgregatRapor;
  pdfUrl?: string | null;
}) {
  const stppa = NARASI_STPPA.filter(([k]) => report[k]);
  const montessori = NARASI_MONTESSORI.filter(([k]) => report[k]);
  const guru = (report.teacher_name as string) || "Guru kelas";

  return (
    <div className="rap">
      <GayaRapor />
      <header className="rap-kepala">
        <div>
          <div className="kecil">RAPOR PERKEMBANGAN</div>
          <div className="nama">{String(report.child_name || "")}</div>
          <div className="sub">
            {String(report.cycle_theme || "Siklus belajar")}
            {report.class_name ? ` · ${String(report.class_name)}` : ""}
            {` · ${formatTanggal(report.cycle_start as string)} – ${formatTanggal(report.cycle_end as string)}`}
          </div>
        </div>
        {pdfUrl ? (
          <div className="rap-kanan"><a className="rap-pil" href={pdfUrl}>⭳ PDF</a></div>
        ) : null}
      </header>

      {stppa.length > 0 ? (
        <section className="rap-seksi">
          <h2>Aspek Perkembangan (STPPA)</h2>
          {stppa.map(([k, label]) => (
            <article className="rap-kartu" key={k}>
              <div className="judul">{label}</div>
              <p>{String(report[k])}</p>
            </article>
          ))}
        </section>
      ) : null}

      {montessori.length > 0 ? (
        <section className="rap-seksi">
          <h2>Area Montessori</h2>
          {montessori.map(([k, label]) => (
            <article className="rap-kartu" key={k}>
              <div className="judul">{label}</div>
              <p>{String(report[k])}</p>
            </article>
          ))}
        </section>
      ) : null}

      {report.conclusion ? (
        <section className="rap-seksi">
          <h2>Kesimpulan</h2>
          <div className="rap-krem">{String(report.conclusion)}</div>
        </section>
      ) : null}

      {report.parent_suggestion ? (
        <section className="rap-seksi">
          <h2>Saran untuk Orang Tua</h2>
          <div className="rap-krem">{String(report.parent_suggestion)}</div>
        </section>
      ) : null}

      {agregat.foto.length > 0 ? (
        <section className="rap-seksi">
          <h2>Dokumentasi Kegiatan</h2>
          <div className="rap-foto">
            {agregat.foto.map((f, i) => (
              <figure key={`${f.url}-${i}`}>
                {f.media_type === "video" ? (
                  <video src={f.url} poster={f.poster_url || undefined} controls preload="metadata" style={{ width: "100%", height: 170, objectFit: "cover", display: "block", background: "#000" }} />
                ) : (
                  <img src={f.url} alt={f.caption || "Foto kegiatan anak"} loading="lazy" />
                )}
                {f.caption ? <figcaption>{f.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rap-seksi">
        <h2>Ringkasan Kehadiran &amp; Tumbuh Kembang</h2>
        <div className="rap-grid2">
          <article className="rap-panel">
            <h3>REKAP PRESENSI</h3>
            <div className="rap-baris"><span className="k">Hadir</span><span className="v">{agregat.hadir} hari</span></div>
            <div className="rap-baris"><span className="k">Izin</span><span className="v">{agregat.izin} hari</span></div>
            <div className="rap-baris"><span className="k">Sakit</span><span className="v">{agregat.sakit} hari</span></div>
            <div className="rap-baris"><span className="k">Tanpa Keterangan</span><span className="v">{agregat.tanpa_keterangan} hari</span></div>
            <div className="garis" />
            <div className="rap-baris"><span className="k">Hari sekolah pada periode ini</span><span className="v">{agregat.hari_sekolah} hari</span></div>
            <div className="rap-baris"><span className="k">Tanpa catatan</span><span className="v">{agregat.tanpa_catatan} hari</span></div>
            <p className="kaki">Hari tanpa catatan berarti sistem tidak menerima presensi pada hari itu — bukan berarti ananda tidak hadir.</p>
            <div className="garis" />
            <div className="rap-baris"><span className="k">Catatan Harian</span><span className="v">{agregat.catatan_harian} laporan</span></div>
          </article>
          <article className="rap-panel">
            <h3>TUMBUH KEMBANG TERKINI</h3>
            <div className="rap-baris"><span className="k">Berat Badan</span><span className="v">{angka(agregat.berat_kg, "kg")}</span></div>
            <div className="rap-baris"><span className="k">Tinggi Badan</span><span className="v">{angka(agregat.tinggi_cm, "cm")}</span></div>
            <div className="rap-baris"><span className="k">Lingkar Kepala</span><span className="v">{angka(agregat.lingkar_kepala_cm, "cm")}</span></div>
            <div className="rap-baris"><span className="k">Status Gizi</span><span className="v">{labelGizi(agregat.status_gizi)}</span></div>
            {agregat.tanggal_ukur ? <p className="kaki">Pengukuran terakhir: {formatTanggal(agregat.tanggal_ukur)}</p> : null}
          </article>
        </div>
      </section>

      <footer className="rap-kaki">
        <span className="rap-ava">{guru.charAt(0).toUpperCase()}</span>
        <span>Dilaporkan oleh: {guru}</span>
        {pdfUrl ? <span style={{ marginLeft: "auto" }}><a className="rap-pil" href={pdfUrl}>⭳ PDF</a></span> : null}
      </footer>
    </div>
  );
}
