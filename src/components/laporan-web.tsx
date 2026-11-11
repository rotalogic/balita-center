// Tampilan laporan harian sebagai halaman web, meniru portal lama sekolah:
// pita tanggal + tombol PDF + pill mood, kartu aktivitas dengan penilaian
// kata (Belum Mampu, Mulai Mampu, Mandiri — tanpa bintang) dan chip
// area/lokasi/mode, kartu Makan/Tidur/Toilet, Catatan Tambahan,
// Circle Time, Moment Special, Saran di Rumah, dan kaki pelapor.
// Dipakai bersama oleh Balita Connect (orang tua) dan detail laporan staf
// supaya bentuk yang dilihat guru sama persis dengan yang diterima orang tua.
// PDF (src/lib/pdf/laporan.ts) mengikuti susunan dan warna yang sama.

import { MerekSekolah } from "./merek-sekolah";
import { kataSkor } from "../lib/skala";
import { SEGMEN_ZKC } from "../lib/segmen";

export type LaporanAktivitas = {
  id?: string;
  title: string;
  apparatus?: string | null;
  area?: string | null;
  rating?: number | string | null;
  notes?: string | null;
  photo_url?: string | null;
  activity_time?: string | null;
  location?: string | null;
  companion?: string | null;
  work_location?: string | null;
  work_mode?: string | null;
};

export type LaporanData = {
  report_date: string;
  mood?: string | null;
  meals_text?: string | null;
  meal_level?: string | null;
  snack_text?: string | null;
  snack_level?: string | null;
  nap_start?: string | null;
  nap_end?: string | null;
  nap_quality?: string | null;
  toilet_pee_count?: number | string | null;
  toilet_poop_count?: number | string | null;
  notes?: string | null;
  circle_theme?: string | null;
  circle_rating?: number | string | null;
  circle_notes?: string | null;
  special_moment?: string | null;
  home_suggestion?: string | null;
};

const AREA: Record<string, string> = {
  practical_life: "Practical Life",
  language: "Language",
  sensorial: "Sensorial",
  mathematics: "Mathematics",
  cultural: "Cultural",
  observasi: "Observasi",
};
const LOKASI: Record<string, string> = { lantai: "Lantai", meja: "Meja", alas: "Alas Kerja", alas_kerja: "Alas Kerja" };
const MODE: Record<string, string> = {
  sendiri: "Sendiri",
  berpasangan: "Berpasangan",
  kelompok_kecil: "Kelompok Kecil",
  kelompok_besar: "Kelompok Besar",
};
// Label mood mengikuti portal lama (bahasa Inggris pada pill).
const MOOD: Record<string, string> = {
  sedih: "Sad",
  cemas: "Anxious",
  biasa: "Calm",
  ceria: "Happy",
  sangat_ceria: "Very Happy",
  lelah: "Tired",
  tenang: "Calm",
  aktif: "Active",
  rewel: "Fussy",
  murung: "Gloomy",
};
const PORSI: Record<string, string> = {
  tidak: "Tidak makan",
  sedikit: "Makan sedikit",
  cukup: "Makan cukup",
  banyak: "Makan banyak",
};
const NAP: Record<string, string> = { buruk: "Tidur kurang nyenyak", cukup: "Tidur cukup", baik: "Tidur nyenyak", sangat_baik: "Tidur sangat nyenyak" };

export const labelArea = (v?: string | null) => (v ? AREA[v] || v : "");
export const labelLokasi = (v?: string | null) => (v ? LOKASI[v] || v : "");
export const labelMode = (v?: string | null) => (v ? MODE[v] || v : "");
export const labelMood = (v?: string | null) => (v ? MOOD[v] || v : "");

function tanggalKepala(iso: string): string {
  const m = String(iso).match(/^\d{4}-\d{2}-\d{2}/);
  const d = m ? new Date(`${m[0]}T00:00:00+07:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(d);
}

function jamTitik(v?: string | null): string {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}.${m[2]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(d).replace(":", ".");
}

function ChipKata({ n }: { n: number }) {
  const kata = kataSkor(n);
  if (!kata) return null;
  return <span className="lap-chip kata">{kata}</span>;
}

function Ikon({ d, size = 18, warna = "currentColor" }: { d: string; size?: number; warna?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const JALUR = {
  kalender: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  unduh: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  denyut: "M22 12h-4l-3 9L9 3l-3 9H2",
  berkas: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  orang: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  bulan: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  tetes: "M12 2.7s6.5 7.1 6.5 11.3a6.5 6.5 0 1 1-13 0C5.5 9.8 12 2.7 12 2.7z",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  buku: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  seru: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01",
};

function GayaLaporan() {
  return (
    <style>{`
      .lap { max-width: 880px; margin: 0 auto; color: #232a31; font-size: 15px; line-height: 1.55; }
      .lap * { box-sizing: border-box; }
      .lap-kepala { background: linear-gradient(120deg, #e9f4fb, #f3fafd); border-radius: 18px; padding: 20px 22px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
      .lap-kal { background: #fff; border-radius: 12px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(23,63,110,.10); flex: none; }
      .lap-kepala .kecil { color: #1d7fa8; font-weight: 700; font-size: 12.5px; letter-spacing: .12em; }
      .lap-kepala .tanggal { font-size: 21px; font-weight: 800; color: #14181d; line-height: 1.25; }
      .lap-kepala .anak { color: #5b6b7a; font-size: 13px; margin-top: 2px; }
      .lap-kanan { margin-left: auto; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .lap-pil { display: inline-flex; align-items: center; gap: 7px; background: #fff; border: 1px solid #dcebf4; color: #15608a; font-weight: 700; font-size: 13.5px; padding: 8px 15px; border-radius: 999px; text-decoration: none; box-shadow: 0 1px 2px rgba(23,63,110,.06); }
      a.lap-pil:hover { background: #f2f9fd; }
      .lap-seksi { margin-top: 26px; }
      .lap-seksi > h2 { display: flex; align-items: center; gap: 9px; font-size: 16.5px; font-weight: 800; letter-spacing: .02em; color: #33383e; margin: 0; text-transform: uppercase; }
      .lap-seksi > h2.biru { color: #15608a; }
      .lap-seksi > h2.merah { color: #cf3365; }
      .lap-seksi > h2.abu { color: #555b63; }
      .lap-sub { color: #77828e; font-size: 13.5px; margin: 6px 0 0; display: flex; align-items: center; gap: 6px; }
      .lap-kartu { background: #fff; border: 1px solid #e6ebef; border-radius: 16px; padding: 18px 20px; margin-top: 14px; box-shadow: 0 1px 3px rgba(23,43,66,.04); }
      .lap-kartu .atas { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .lap-kartu .judul { font-size: 17px; font-weight: 700; color: #191d22; }
      .lap-skor { display: flex; align-items: center; gap: 7px; color: #68727d; font-size: 13.5px; white-space: nowrap; }
      .lap-chip.kata { background: #eef4ea; color: #3f6212; }
      .lap-chiprow { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .lap-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 5px 11px; border-radius: 9px; }
      .lap-chip.area { background: #fce9ef; color: #9d2c4a; }
      .lap-chip.lokasi { background: #e8f3fa; color: #1d6f9f; }
      .lap-chip.mode { background: #fbf6df; color: #857017; }
      .lap-catatan { margin: 13px 0 0; color: #3c454e; }
      .lap-catatan strong { color: #232a31; }
      .lap-sampul { margin-top: 16px; }
      .lap-sampul img { width: 100%; height: 190px; object-fit: cover; border-radius: 16px; display: block; }
      @media (max-width: 640px) { .lap-sampul img { height: 130px; } }
      .lap-mini .ilus { width: 100%; height: 96px; object-fit: cover; border-radius: 10px; display: block; margin-bottom: 11px; }
      .lap-foto { margin-top: 13px; }
      .lap-foto img { width: min(500px, 100%); border-radius: 12px; display: block; }
      .lap-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
      @media (max-width: 640px) { .lap-grid2 { grid-template-columns: 1fr; } .lap-kanan { margin-left: 0; } }
      .lap-mini { background: #fff; border: 1px solid #e6ebef; border-radius: 16px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(23,43,66,.04); }
      .lap-mini .label { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 13.5px; letter-spacing: .05em; }
      .lap-mini .besar { font-size: 18.5px; font-weight: 700; color: #191d22; margin-top: 7px; }
      .lap-mini .sub { color: #77828e; font-size: 13.5px; margin-top: 3px; }
      .lap-toilet { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
      .lap-toilet .label { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 13.5px; letter-spacing: .05em; color: #1d7fa8; margin-right: auto; }
      .lap-toilet .sel { text-align: center; min-width: 110px; }
      .lap-toilet .angka { font-size: 21px; font-weight: 800; color: #191d22; }
      .lap-toilet .ket { color: #77828e; font-size: 12.5px; letter-spacing: .06em; }
      .lap-toilet .pisah { width: 1px; align-self: stretch; background: #e6ebef; }
      .lap-krim { background: #fdfbf1; border: 1px solid #f2ead2; border-radius: 14px; padding: 16px 20px; margin-top: 12px; color: #2f353c; }
      .lap-birumuda { background: #eff7fc; border: 1px solid #d9ebf6; border-radius: 16px; padding: 18px 20px; margin-top: 12px; }
      .lap-birumuda .judul { color: #15608a; font-weight: 700; font-size: 16.5px; }
      .lap-birumuda p { margin: 10px 0 0; color: #2f353c; }
      .lap-momen { background: #fff; border: 1px solid #dde3e8; border-radius: 16px; padding: 16px 20px; margin-top: 12px; color: #2f353c; }
      .lap-momen .kosong { color: #8a94a0; }
      .lap-saran { background: #fdeef1; border: 1px solid #f7d2da; border-radius: 16px; padding: 18px 20px; margin-top: 12px; color: #8e2247; }
      .lap-kaki { display: flex; align-items: center; gap: 11px; margin-top: 28px; padding-top: 16px; border-top: 1px solid #edf0f3; flex-wrap: wrap; }
      .lap-ava { width: 34px; height: 34px; border-radius: 50%; background: #e8ebee; color: #5b656f; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex: none; }
      .lap-ava-img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex: none; }
      .lap-ttd { height: 40px; max-width: 130px; object-fit: contain; margin-left: auto; }
      .lap-kaki .oleh { color: #5b656f; font-size: 13.5px; margin-right: auto; }
    `}</style>
  );
}

export function LaporanWeb({
  report,
  activities,
  segments,
  childName,
  reporterName,
  reporterPhoto,
  reporterTtd,
  pdfUrl,
}: {
  report: LaporanData;
  activities: LaporanAktivitas[];
  segments?: Array<{ segmen: string; catatan: string }>;
  childName: string;
  reporterName?: string | null;
  reporterPhoto?: string | null;
  reporterTtd?: string | null;
  pdfUrl?: string | null;
}) {
  const segmenTerisi = SEGMEN_ZKC
    .map((s) => ({ ...s, catatan: (segments || []).find((x) => x.segmen === s.kunci)?.catatan || "" }))
    .filter((s) => s.catatan.trim());
  const moodLabel = labelMood(report.mood);
  const napTeks = report.nap_start || report.nap_end
    ? `${jamTitik(report.nap_start) || "--.--"}–${jamTitik(report.nap_end) || "--.--"}`
    : report.nap_quality
      ? NAP[report.nap_quality] || report.nap_quality
      : "-";
  const makanBesar = report.meals_text || report.snack_text || (report.meal_level ? PORSI[report.meal_level] || report.meal_level : "-");
  const circleRating = Number(report.circle_rating || 0);

  return (
    <div className="lap">
      <MerekSekolah />
      <GayaLaporan />
      <header className="lap-kepala">
        <span className="lap-kal"><Ikon d={JALUR.kalender} size={22} warna="#1d7fa8" /></span>
        <div>
          <div className="kecil">LAPORAN HARIAN</div>
          <div className="tanggal">{tanggalKepala(report.report_date)}</div>
          <div className="anak">{childName}</div>
        </div>
        <div className="lap-kanan">
          {pdfUrl ? (
            <a className="lap-pil" href={pdfUrl}><Ikon d={JALUR.unduh} size={15} warna="#15608a" /> PDF</a>
          ) : null}
          {moodLabel ? (
            <span className="lap-pil">✦ Mood: {moodLabel}</span>
          ) : null}
        </div>
      </header>

      <div className="lap-sampul"><img src="/ilustrasi/sampul-laporan.jpg" alt="Ilustrasi anak bermain material Montessori di kelas" /></div>

      {segmenTerisi.length > 0 ? (
        <section className="lap-seksi">
          <h2><Ikon d={JALUR.kalender} size={19} warna="#1d7fa8" /> Jalannya Sesi Hari Ini</h2>
          <p className="lap-sub">Sembilan segmen sesi Ziel Kids Club, berurutan dari kedatangan sampai doa penutup</p>
          {segmenTerisi.map((s, i) => (
            <div className="lap-kartu" key={s.kunci}>
              <p className="lap-catatan" style={{ marginTop: 0 }}>
                <strong>{i + 1}. {s.label}</strong> — {s.catatan}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="lap-seksi">
        <h2><Ikon d={JALUR.denyut} size={19} warna="#1d7fa8" /> Aktivitas &amp; Pembelajaran</h2>
        <p className="lap-sub">Penilaian memakai kata: Belum Mampu, Mulai Mampu, dan Mandiri <Ikon d={JALUR.info} size={15} warna="#7fa6bd" /></p>
        {activities.length === 0 ? (
          <div className="lap-kartu"><p className="lap-catatan" style={{ marginTop: 0 }}>Belum ada aktivitas tercatat pada laporan ini.</p></div>
        ) : activities.map((a, i) => {
          const rating = Math.max(0, Math.min(3, Math.round(Number(a.rating) || 0)));
          const area = labelArea(a.area);
          const lokasi = labelLokasi(a.work_location) || a.location || "";
          const mode = labelMode(a.work_mode) || a.companion || "";
          return (
            <article className="lap-kartu" key={a.id || i}>
              <div className="atas">
                <span className="judul">{a.title}</span>
                {rating > 0 ? (
                  <span className="lap-skor"><ChipKata n={rating} /></span>
                ) : null}
              </div>
              {(area || lokasi || mode) ? (
                <div className="lap-chiprow">
                  {area ? <span className="lap-chip area"><Ikon d={JALUR.buku} size={13} warna="#9d2c4a" /> {area}</span> : null}
                  {lokasi ? <span className="lap-chip lokasi"><Ikon d={JALUR.pin} size={13} warna="#1d6f9f" /> {lokasi}</span> : null}
                  {mode ? <span className="lap-chip mode"><Ikon d={JALUR.orang} size={13} warna="#857017" /> {mode}</span> : null}
                </div>
              ) : null}
              {a.notes ? <p className="lap-catatan"><strong>Catatan guru:</strong> {a.notes}</p> : null}
              {a.photo_url ? (
                <div className="lap-foto"><img src={a.photo_url} alt={`Foto aktivitas ${a.title}`} loading="lazy" /></div>
              ) : null}
            </article>
          );
        })}
      </section>

      <div className="lap-grid2">
        <article className="lap-mini">
          <img className="ilus" src="/ilustrasi/makan-bersama.jpg" alt="Ilustrasi anak makan bersama" loading="lazy" />
          <div className="label" style={{ color: "#cf3365" }}>🍴 MAKAN</div>
          <div className="besar">{makanBesar}</div>
          {report.meals_text && report.meal_level ? <div className="sub">{PORSI[report.meal_level] || report.meal_level}</div> : null}
          {report.snack_text ? <div className="sub">Snack: {report.snack_text}{report.snack_level ? ` · ${PORSI[report.snack_level] || report.snack_level}` : ""}</div> : null}
        </article>
        <article className="lap-mini">
          <img className="ilus" src="/ilustrasi/tidur-siang.jpg" alt="Ilustrasi anak tidur siang" loading="lazy" />
          <div className="label" style={{ color: "#5b54c7" }}><Ikon d={JALUR.bulan} size={15} warna="#5b54c7" /> TIDUR</div>
          <div className="besar">{napTeks}</div>
          {(report.nap_start || report.nap_end) && report.nap_quality ? <div className="sub">{NAP[report.nap_quality] || report.nap_quality}</div> : null}
        </article>
      </div>
      <article className="lap-mini lap-toilet">
        <span className="label"><Ikon d={JALUR.tetes} size={15} warna="#1d7fa8" /> TOILET</span>
        <span className="sel"><span className="angka">{Number(report.toilet_pee_count) || 0}</span><br /><span className="ket">BAK</span></span>
        <span className="pisah" />
        <span className="sel"><span className="angka">{Number(report.toilet_poop_count) || 0}</span><br /><span className="ket">BAB</span></span>
      </article>

      {report.notes ? (
        <section className="lap-seksi">
          <h2><Ikon d={JALUR.berkas} size={18} warna="#c9a227" /> Catatan Tambahan</h2>
          <div className="lap-krim">{report.notes}</div>
        </section>
      ) : null}

      {report.circle_theme || report.circle_notes ? (
        <section className="lap-seksi">
          <h2 className="biru"><Ikon d={JALUR.orang} size={18} warna="#15608a" /> Circle Time <Ikon d={JALUR.info} size={15} warna="#7fa6bd" /></h2>
          <div className="lap-birumuda">
            {report.circle_theme ? <div className="judul">{report.circle_theme}</div> : null}
            {circleRating > 0 ? <div style={{ marginTop: 5 }}><ChipKata n={circleRating} /></div> : null}
            {report.circle_notes ? <p>{report.circle_notes}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="lap-seksi">
        <h2 className="abu">✦ Moment Special <Ikon d={JALUR.info} size={15} warna="#7fa6bd" /></h2>
        <div className="lap-momen">
          {report.special_moment ? report.special_moment : <span className="kosong">Tidak ada kejadian spesifik hari ini.</span>}
        </div>
      </section>

      {report.home_suggestion ? (
        <section className="lap-seksi">
          <h2 className="merah"><Ikon d={JALUR.seru} size={18} warna="#cf3365" /> Saran di Rumah <Ikon d={JALUR.info} size={15} warna="#7fa6bd" /></h2>
          <div className="lap-saran">{report.home_suggestion}</div>
        </section>
      ) : null}

      <footer className="lap-kaki">
        {reporterPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lap-ava-img" src={reporterPhoto} alt={reporterName || "Guru"} />
        ) : (
          <span className="lap-ava">{(reporterName || childName || "G").trim().charAt(0).toUpperCase()}</span>
        )}
        <span className="oleh">Dilaporkan oleh: {reporterName || "Guru kelas"}</span>
        {reporterTtd ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lap-ttd" src={reporterTtd} alt="Tanda tangan guru" />
        ) : null}
        {pdfUrl ? (
          <a className="lap-pil" href={pdfUrl}><Ikon d={JALUR.unduh} size={15} warna="#15608a" /> PDF</a>
        ) : null}
      </footer>
    </div>
  );
}
