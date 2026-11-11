import Link from "next/link";
import { LANGKAH_ZIEL, WA_LINK } from "@/lib/publik";

export default function ZkcPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Ziel Kids Club</h1>
        <p className="tag">Building Strong Foundations Before Learning</p>
        <p style={{ maxWidth: 720, color: "#57462f", lineHeight: 1.6 }}>
          Ziel Kids Club adalah rumah fondasi bagi anak usia 6 bulan sampai 6 tahun. Di sinilah tahapan
          perkembangan anak dibaca dengan teliti dan fondasi belajarnya diperkuat — sebelum anak dibebani target
          akademik apa pun.
        </p>
        <p><Link className="pb-btn" href="/website/bergabung">Bergabung dengan Ziel Kids Club</Link></p>
      </section>

      <section className="pb-sec">
        <h2>Ziel Development System — Lima Langkah</h2>
        <div className="pb-grid">
          {LANGKAH_ZIEL.map((l, i) => (
            <article className="pb-card" key={l}>
              <h3>{i + 1}. {l}</h3>
              <p>{
                [
                  "Mengamati anak apa adanya pada kegiatan nyata yang ia jalani.",
                  "Memahami kekuatan, ritme, dan kebutuhan anak dari hasil pengamatan.",
                  "Memberikan stimulasi yang sesuai dengan tahap dan kebutuhan anak.",
                  "Memantau perubahan anak dari waktu ke waktu secara berkala.",
                  "Anak bertumbuh dengan fondasi yang makin kokoh dan percaya diri.",
                ][i]
              }</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-sec">
        <h2>Empat Jalan Pendampingan</h2>
        <div className="pb-grid">
          <article className="pb-card">
            <h3>Program Reguler</h3>
            <p>Pendampingan perkembangan menyeluruh dalam kelompok tahap Bibit, Tunas, dan Mekar — sesi 60 menit berisi rangkaian kegiatan fondasi: gerak, sensori, keterampilan hidup dasar, dan bahasa.</p>
          </article>
          <article className="pb-card">
            <h3>Kelas Movement dengan Boulder Wall Climbing</h3>
            <p>Kelas gerak 90 menit untuk kekuatan, keseimbangan, keberanian, dan regulasi anak — dengan Boulder Wall Climbing sebagai salah satu stasiun utamanya.</p>
          </article>
          <article className="pb-card">
            <h3>Program Khusus Calistung Pendekatan Montessori ZKC</h3>
            <p>
              Ditampilkan kepada keluarga sebagai <strong>Calistung dengan Aparatus Montessori Autentik</strong> —
              dengan penjaga yang selalu menyertainya: kata autentik melekat pada <em>aparatus</em> yang digunakan,
              bukan pada programnya. Montessori autentik sebagai program utuh hanya diselenggarakan di Sekolah Alam
              Montessori.
            </p>
          </article>
          <article className="pb-card">
            <h3>Pendampingan Individual</h3>
            <p>Program pendampingan satu anak satu guru bagi anak yang memerlukan perhatian lebih terarah, disusun dari hasil observasi dan pemetaan kebutuhan anak.</p>
          </article>
        </div>
      </section>

      <section className="pb-sec">
        <h2>Cara Bergabung</h2>
        <p className="lead">
          Isi formulir pendaftaran ringan, ikuti Trial atau Discovery, hadiri sesi hasil bersama guru dan pendiri,
          lalu registrasi dan orientasi. Keluarga selalu menerima penjelasan hasil sebelum memutuskan.
        </p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="pb-btn" href="/website/bergabung">Isi Formulir Pendaftaran</Link>
          <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Tanya via WhatsApp</a>
        </p>
      </section>
    </>
  );
}
