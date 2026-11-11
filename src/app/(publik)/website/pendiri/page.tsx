import Link from "next/link";
import { BENANG_MERAH, CERITA_BUKTI_HIDUP, JUDUL_BUKTI_HIDUP } from "@/lib/publik";

// Profil Pendiri — seluruh isinya memakai rekam jejak nyata pendiri
// sebagaimana diberikan lembaga, tanpa mengarang. Status pendidikan dan
// pelatihan yang masih ditempuh ditandai apa adanya sebagai kandidat atau
// sedang ditempuh.
export default function PendiriPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Profil Pendiri</h1>
        <p className="tag">Ayu Najiba — Founder Ziel Kids Club &amp; Sekolah Alam Montessori, Montessori &amp; Child Development Practitioner</p>
        <p style={{ maxWidth: 740, color: "#57462f", lineHeight: 1.65 }}>
          Ayu Najiba adalah ibu tiga anak dan praktisi perkembangan anak. Seluruh yang ia bangun — dari program
          dan layanan sampai lembaga ini — adalah hasil praktiknya sendiri dan pendampingannya terlebih dahulu,
          yang dijalani langsung pada anak-anaknya sendiri dan pada keluarga yang ia dampingi; sesudah praktik itu
          berjalan, barulah ia mendalami ilmunya secara formal. Setiap pengalaman pada profil ini berakar pada
          praktik yang benar-benar dijalani, bukan teori yang belum pernah dipraktikkan.
        </p>
        <p style={{ maxWidth: 740, color: "#57462f", lineHeight: 1.65 }}>
          Di rumahnya sendiri, ketiga anak pendiri menjalani keseharian tanpa gawai. Waktu bermain mereka lebih
          banyak dihabiskan di alam terbuka — sawah, kebun, dan ruang hijau — ruang yang lebih sering dipilih
          keluarga pendiri dibandingkan taman bermain buatan, karena di alam anak bergerak bebas, kaya pengalaman
          sensori, dan berlatih regulasi secara alami.
        </p>
      </section>

      <section className="pb-sec">
        <h2>Pengalaman dan Peran</h2>
        <div className="pb-grid">
          <article className="pb-card">
            <h3>Pendampingan Rujukan Keluarga</h3>
            <p>Berpengalaman mendampingi keluarga dalam proses rujukan sampai mengantar langsung keluarga berkonsultasi kepada psikolog klinis mitra.</p>
          </article>
          <article className="pb-card">
            <h3>Skrining &amp; Identifikasi Dini</h3>
            <p>Berpengalaman melakukan praktik skrining dan identifikasi dini perkembangan anak serta risiko kesulitan belajar di banyak sekolah di Malang Raya sebagai utusan gerakan literasi.</p>
          </article>
          <article className="pb-card">
            <h3>Konsultasi &amp; Penjelasan Hasil</h3>
            <p>Berpengalaman menerima konsultasi orang tua serta memimpin sesi penjelasan hasil observasi anak.</p>
          </article>
          <article className="pb-card">
            <h3>Ibu dari Dua Atlet Cilik</h3>
            <p>Mengarahkan kekuatan dan minat dua anaknya sendiri dari atlet pushbike menjadi atlet panjat tebing Kota Malang — praktik pengarahan bakat minat yang ia jalani bertahun-tahun di keluarganya sendiri.</p>
          </article>
        </div>
      </section>

      <section className="pb-sec">
        <h2>Keahlian dan Peran Lainnya</h2>
        <div className="pb-grid">
          <article className="pb-card"><h3>Pendampingan Rujukan</h3><p>Pendampingan rujukan beserta penyiapan berkas pemetaan untuk profesional.</p></article>
          <article className="pb-card"><h3>Pendampingan Kebutuhan Dukungan Spesifik</h3><p>Mendampingi anak dengan kebutuhan dukungan spesifik di dalam batas non klinis.</p></article>
          <article className="pb-card"><h3>Kurikulum &amp; Sistem Lembaga</h3><p>Membangun kurikulum, sistem asesmen observasi, serta standar operasional lembaga pendidikan anak.</p></article>
          <article className="pb-card"><h3>Personal Branding &amp; Pemetaan</h3><p>Terampil membangun personal branding dan terampil melakukan pemetaan — mencakup pemetaan perkembangan anak dan pemetaan bakat minat — sebagai keahlian yang menopang perannya sebagai praktisi.</p></article>
        </div>
      </section>

      <section className="pb-sec">
        <h2>Pendidikan, Pelatihan, dan Sertifikasi</h2>
        <div className="pb-card">
          <p>
            Pendiri menempuh jalur Montessori dan pengembangan anak secara formal sesudah praktiknya berjalan.
            Jalur yang masih berjalan selalu ditulis apa adanya sebagai <strong>kandidat</strong> atau <strong>sedang
            ditempuh</strong> — termasuk kandidasi Indonesia Dyslexia Specialist Teacher, tempat kerangka
            NoticeAbility dipelajari — dan tidak pernah ditulis sebagai gelar atau sertifikasi yang sudah selesai.
          </p>
        </div>
      </section>

      <section className="pb-sec">
        <h2>{JUDUL_BUKTI_HIDUP}</h2>
        <div className="pb-card">
          <p>{CERITA_BUKTI_HIDUP}</p>
        </div>
      </section>

      <section className="pb-sec">
        <h2>Setiap layanan kami berdiri di atas pengalaman nyata pendirinya</h2>
        <div className="pb-grid">
          {BENANG_MERAH.map(([layanan, pengalaman]) => (
            <article className="pb-card" key={layanan}>
              <h3>{layanan}</h3>
              <p>{pengalaman}</p>
            </article>
          ))}
        </div>
        <p style={{ marginTop: 16 }}>
          <Link className="pb-btn" href="/website/bergabung">Kenal Lembaga Lewat Konsultasi Pertama</Link>
        </p>
      </section>
    </>
  );
}
