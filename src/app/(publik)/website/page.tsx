import Link from "next/link";
import { SeksiEvent, SeksiInvestasi } from "@/components/publik-data";
import {
  ALAMAT_LEMBAGA, ALUR_SAM, DURASI_PROGRAM, KALIMAT_KONSULTASI_GRATIS, LANGKAH_ZIEL,
  MAPS_LINK, MISI, MOTTO, VISI, WA_LINK,
} from "@/lib/publik";

export default function BerandaPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Ziel Kids Club &amp; Sekolah Alam Montessori</h1>
        <p className="tag">Understanding Children. Strengthening Families. Learning Naturally. Growing Meaningfully.</p>
        <p style={{ maxWidth: 720, color: "#57462f", lineHeight: 1.6 }}>
          Dua rumah belajar dalam satu yayasan di Malang: <strong>Ziel Kids Club</strong> untuk fondasi perkembangan
          anak usia 6 bulan sampai 6 tahun, dan <strong>Sekolah Alam Montessori</strong> untuk pendidikan Montessori
          autentik yang berakar pada alam dan nilai Islam.
        </p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="pb-btn" href="/website/bergabung">Bergabung</Link>
          <Link className="pb-btn garis" href="/website/zkc">Profil Ziel Kids Club</Link>
          <Link className="pb-btn garis" href="/website/sam">Profil Sekolah Alam Montessori</Link>
        </p>
        <p style={{ color: "#57462f", fontStyle: "italic", marginBottom: 0 }}>{KALIMAT_KONSULTASI_GRATIS}</p>
      </section>

      <section className="pb-strip" style={{ marginTop: 18 }} aria-label="Visi dan Misi">
        <h3>Visi</h3>
        <p style={{ margin: 0 }}>{VISI}</p>
        <h3 style={{ marginTop: 12 }}>Misi</h3>
        <ul>{MISI.map((m) => <li key={m}>{m}</li>)}</ul>
        <p style={{ margin: 0 }}><strong>{MOTTO}</strong></p>
      </section>

      <section className="pb-sec" id="profil">
        <h2>Profil Dua Rumah</h2>
        <div className="pb-grid">
          <article className="pb-card">
            <h3>Ziel Kids Club — Building Strong Foundations Before Learning</h3>
            <p>
              Rumah fondasi bagi anak 6 bulan sampai 6 tahun: tahapan perkembangan anak dibaca dengan teliti dan
              fondasi belajarnya diperkuat sebelum akademik. Pendampingannya berjalan lewat Ziel Development System: {LANGKAH_ZIEL.join(" · ")}.
            </p>
            <p style={{ marginTop: 10 }}><Link className="pb-btn" href="/website/zkc">Kenali Ziel Kids Club</Link></p>
          </article>
          <article className="pb-card">
            <h3>Sekolah Alam Montessori</h3>
            <p>
              Authentic Montessori, Rooted in Nature, Growing with Islamic Values, Moving with Purpose. Lingkungan
              NIDO (18 bulan – 3 tahun) dan CASA (3 – 6 tahun) dengan material autentik Montessori pada lima area:
              Practical Life, Sensorial, Bahasa, Matematika, dan Budaya.
            </p>
            <p style={{ marginTop: 10 }}><Link className="pb-btn hijau" href="/website/sam">Kenali Sekolah Alam Montessori</Link></p>
          </article>
        </div>
      </section>

      <section className="pb-sec" id="keunggulan">
        <h2>Keunggulan — Bedanya dengan TK dan Sekolah Biasa</h2>
        <p className="lead">
          Kami menghormati taman kanak-kanak dan sekolah biasa sebagai pilihan banyak keluarga. Yang berbeda di sini
          adalah titik berangkatnya: anak dipahami lebih dulu lewat observasi, baru kemudian didampingi — tanpa target
          capaian yang dibebankan kepada anak.
        </p>
        <div className="pb-grid">
          <article className="pb-card"><h3>Berangkat dari Observasi</h3><p>Setiap pendampingan dimulai dari membaca anak apa adanya: kekuatan, ritme, dan kebutuhannya — bukan dari tuntutan kurikulum yang sama untuk semua.</p></article>
          <article className="pb-card"><h3>Fondasi Sebelum Akademik</h3><p>Regulasi, gerak, sensori, dan kemandirian diperkuat lebih dulu; kemampuan akademik tumbuh sebagai akibat fondasi yang kokoh.</p></article>
          <article className="pb-card"><h3>Keluarga sebagai Mitra</h3><p>Orang tua menerima laporan yang jujur dan sesi penjelasan hasil — keluarga adalah mitra utama perjalanan anak.</p></article>
          <article className="pb-card"><h3>Deteksi Dini yang Inklusif</h3><p>Tanda kebutuhan dukungan terbaca lebih awal dan diarahkan dengan bertanggung jawab, dalam batas pendampingan non klinis.</p></article>
        </div>
      </section>

      <section className="pb-sec" id="nilai-kami">
        <h2>Nilai Kami</h2>
        <div className="pb-grid">
          <article className="pb-card"><h3>Memahami Anak</h3><p>Anak bukan untuk dibentuk tergesa-gesa, melainkan dipahami dengan sabar dan teliti.</p></article>
          <article className="pb-card"><h3>Menguatkan Keluarga</h3><p>Lembaga berjalan bersama keluarga — pola di lembaga dan di rumah saling menguatkan.</p></article>
          <article className="pb-card"><h3>Belajar Secara Alami</h3><p>Alam, gerak, dan pengalaman nyata adalah ruang belajar pertama anak.</p></article>
          <article className="pb-card"><h3>Berakar pada Nilai Islam</h3><p>Kehidupan sehari-hari anak dibingkai adab, doa, dan kebiasaan baik yang hidup.</p></article>
        </div>
      </section>

      <section className="pb-sec" id="program">
        <h2>Program &amp; Durasi Sesi</h2>
        <p className="lead">Pilih rumah sesuai usia anak: Ziel Kids Club menerima anak 6 bulan sampai 6 tahun; Sekolah Alam Montessori menerima NIDO 18 bulan – 3 tahun dan CASA 3 – 6 tahun.</p>
        <div className="pb-grid">
          {DURASI_PROGRAM.map(([nama, durasi]) => (
            <article className="pb-card" key={nama}><h3>{nama}</h3><p>Durasi sesi: <strong>{durasi}</strong></p></article>
          ))}
        </div>
        <p style={{ color: "#57462f" }}>
          Penerimaan SAM berjalan bergulir sepanjang tahun dengan alur: {ALUR_SAM.join(" → ")}.
        </p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="pb-btn" href="/website/layanan">Lihat Layanan &amp; Skrining</Link>
          <Link className="pb-btn garis" href="/website/bergabung">Isi Formulir Pendaftaran</Link>
        </p>
      </section>

      <section className="pb-sec" id="orang-tua">
        <h2>Bagi Orang Tua</h2>
        <div className="pb-grid">
          <article className="pb-card"><h3>Laporan yang Bisa Dibaca</h3><p>Laporan harian dan rapor periodik ditulis dalam bahasa sehari-hari dan dapat dibaca kapan pun dari Portal Orang Tua.</p></article>
          <article className="pb-card"><h3>Sesi Penjelasan Hasil</h3><p>Hasil observasi dan pemetaan selalu disampaikan langsung dalam sesi penjelasan — bukan sekadar berkas yang dikirim.</p></article>
          <article className="pb-card"><h3>Pola Asuh yang Selaras</h3><p>Setiap laporan ditutup rekomendasi dan tips pola asuh agar pendampingan di rumah berjalan searah.</p></article>
        </div>
      </section>

      <section className="pb-sec" id="event">
        <h2>Event &amp; Kegiatan Terdekat</h2>
        <SeksiEvent />
      </section>

      <section className="pb-sec" id="investasi">
        <h2>Investasi</h2>
        <p className="lead">Hanya angka yang sudah final yang kami tampilkan di halaman ini. Untuk program yang investasinya belum final, silakan konfirmasi kepada admin.</p>
        <SeksiInvestasi />
      </section>

      <section className="pb-sec" id="lokasi">
        <h2>Lokasi</h2>
        <div className="pb-card">
          <h3>{ALAMAT_LEMBAGA}</h3>
          <p>Kunjungi kami dengan janji terlebih dahulu agar kami dapat menyambut keluarga dengan baik.</p>
          <p style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="pb-btn garis" href={MAPS_LINK} target="_blank" rel="noreferrer">Buka Peta</a>
            <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Hubungi Admin</a>
          </p>
        </div>
      </section>
    </>
  );
}
