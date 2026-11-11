import Link from "next/link";
import { ALUR_SAM, AREA_SAM, IDENTITAS_SAM, PILAR_SAM, WA_LINK } from "@/lib/publik";

export default function SamPage() {
  return (
    <>
      <section className="pb-hero">
        <h1 style={{ color: "var(--sam)" }}>Sekolah Alam Montessori</h1>
        <p className="tag">{IDENTITAS_SAM}</p>
        <p style={{ maxWidth: 720, color: "#57462f", lineHeight: 1.6 }}>
          Montessori autentik dengan material autentik Montessori dan aparatus berkualitas, di lingkungan alam
          yang tenang dan tertib — untuk anak NIDO (18 bulan – 3 tahun) dan CASA (3 – 6 tahun).
        </p>
        <p><Link className="pb-btn hijau" href="/website/bergabung">Bergabung dengan Sekolah Alam Montessori</Link></p>
      </section>

      <section className="pb-sec">
        <h2>Empat Pilar SAM</h2>
        <div className="pb-grid">
          {PILAR_SAM.map((p) => (
            <article className="pb-card" key={p}><h3>{p}</h3>
              <p>{
                {
                  Natural: "Alam adalah ruang belajar pertama: bahan alami, benda nyata, dan pengalaman langsung di ruang hijau.",
                  Montessori: "Metode Montessori autentik dengan lingkungan yang disiapkan dan kebebasan yang bertanggung jawab.",
                  Movement: "Gerak adalah bagian utuh pembelajaran — anak bergerak dengan tujuan setiap hari.",
                  Islami: "Kehidupan Islam sehari-hari hidup di kelas: doa, adab, dan kebiasaan baik yang diteladankan.",
                }[p]
              }</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-sec">
        <h2>Lima Area Montessori</h2>
        <div className="pb-grid">
          {AREA_SAM.map((a) => (
            <article className="pb-card" key={a}><h3>{a}</h3>
              <p>{
                {
                  "Practical Life": "Latihan kehidupan praktis: merawat diri, merawat lingkungan, dan menyiapkan makanan sederhana.",
                  Sensorial: "Penghalusan indra lewat material yang dirancang bertingkat dan presisi.",
                  Bahasa: "Lingkungan bahasa yang kaya, lisan dan tertulis, dalam Bahasa Indonesia, Arab, dan pengantar Inggris.",
                  Matematika: "Konsep jumlah dan operasi dibangun dari benda konkret menuju abstrak.",
                  Budaya: "Pengenalan dunia: alam, geografi, sains sederhana, dan seni.",
                }[a]
              }</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-sec">
        <h2>Lingkungan &amp; Pembelajaran Mendalam</h2>
        <div className="pb-grid">
          <article className="pb-card">
            <h3>Lingkungan yang Tenang dan Tertib</h3>
            <p>Keindahan kelas kami lahir dari keteraturan, bahan alami, dan benda nyata — tanpa dekorasi berlebihan. Di lingkungan seperti inilah konsentrasi anak bertumbuh.</p>
          </article>
          <article className="pb-card">
            <h3>Mindful · Meaningful · Joyful</h3>
            <p>Pembelajaran mendalam di SAM berjalan dengan tiga prinsip: penuh kesadaran, bermakna, dan menggembirakan — wujud integrasi kurikulum nasional dan Montessori.</p>
          </article>
          <article className="pb-card">
            <h3>Bahasa Arab &amp; Mengaji Metode Ummi</h3>
            <p>Bahasa Arab hadir sebagai bahasa ibadah dan Al-Qur'an. Anak belajar membaca Al-Qur'an bertahap dan menyenangkan lewat talaqqi langsung bersama guru, bacaan tartil dengan makhraj yang benar — berjalan dari Jilid 1 sampai siap membaca Al-Qur'an, dengan kenaikan jilid melalui munaqosyah.</p>
          </article>
          <article className="pb-card">
            <h3>Snack Sehat adalah Kerja Anak</h3>
            <p>Waktu snack di SAM adalah kerja Practical Life itu sendiri di dalam EPL dan Food Preparation: anak menyiapkan bekalnya sendiri, dari mencuci buah sampai membereskan. Bekal dibawa dari rumah — ini bukan layanan katering.</p>
          </article>
        </div>
        <p style={{ color: "#57462f" }}>
          Delapan Prinsip Montessori hidup di setiap kelas SAM dan menjadi pegangan guide dalam menyiapkan
          lingkungan serta membersamai anak setiap hari.
        </p>
      </section>

      <section className="pb-sec">
        <h2>Alur Bergabung (Penerimaan Bergulir)</h2>
        <p className="lead">{ALUR_SAM.join(" → ")}</p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="pb-btn hijau" href="/website/bergabung">Mulai dari Formulir</Link>
          <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Tanya via WhatsApp</a>
        </p>
      </section>
    </>
  );
}
