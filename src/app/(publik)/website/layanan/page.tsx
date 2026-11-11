import Link from "next/link";
import { JENIS_SKRINING } from "@/lib/skrining";
import { NAMA_LAYANAN } from "@/lib/minat";
import { CERITA_BUKTI_HIDUP, JUDUL_BUKTI_HIDUP, KALIMAT_KONSULTASI_GRATIS, WA_LINK } from "@/lib/publik";

export default function LayananPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Layanan &amp; Skrining</h1>
        <p className="tag">Deteksi dini dan konsultasi dalam batas pendampingan non klinis — pemetaan, bukan diagnosis.</p>
        <p style={{ color: "#57462f", fontStyle: "italic" }}>{KALIMAT_KONSULTASI_GRATIS}</p>
      </section>

      <section className="pb-sec">
        <h2>Layanan Skrining</h2>
        <p className="lead">
          Tujuh layanan skrining berdiri sendiri untuk membaca perkembangan anak dan kesiapan belajarnya.
          Hasilnya disampaikan sebagai peta perkembangan dalam sesi penjelasan bersama pendiri — bahasa yang
          dipakai selalu bahasa pemetaan, tidak pernah diagnosis.
        </p>
        <div className="pb-grid">
          {JENIS_SKRINING.map(([kunci, nama]) => (
            <article className="pb-card" key={kunci}>
              <h3>{nama}</h3>
              <p style={{ marginTop: 10 }}>
                <Link className="pb-btn" href={`/website/bergabung?layanan=skrining:${kunci}`}>Daftar Layanan Ini</Link>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-sec">
        <h2>{NAMA_LAYANAN}</h2>
        <div className="pb-card">
          <p style={{ marginBottom: 10 }}>
            Layanan konsultasi tersendiri yang diterima langsung oleh pendiri, untuk anak dan remaja mulai usia
            empat tahun. Keluarga menerima Peta Kekuatan dan Minat beserta Rekomendasi Pengarahan yang konkret:
            pilihan kegiatan dan ekstrakurikuler yang sesuai, program pendampingan di lembaga bila relevan, dan
            arah persiapan jenjang berikutnya. Kecenderungan arah anak dibaca sebagai kecenderungan yang teramati
            untuk dikembangkan — bukan ramalan profesi dan bukan label tetap.
          </p>
          <p style={{ marginBottom: 10 }}>
            Pemetaan diperkaya kerangka kekuatan dari kurikulum NoticeAbility, yang dipelajari dan diterapkan
            pendiri melalui program kandidasi Indonesia Dyslexia Specialist Teacher. Penerapan kerangka ini bukan
            sertifikasi NoticeAbility dan bukan afiliasi resmi lembaga dengan organisasi NoticeAbility.
          </p>
          <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="pb-btn" href="/website/bergabung?layanan=minat_bakat">Daftar Konsultasi Ini</Link>
            <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Tanya via WhatsApp</a>
          </p>
        </div>
        <div className="pb-card" style={{ marginTop: 14 }}>
          <h3>{JUDUL_BUKTI_HIDUP}</h3>
          <p>{CERITA_BUKTI_HIDUP}</p>
        </div>
      </section>

      <section className="pb-sec">
        <h2>Pendampingan Individual</h2>
        <div className="pb-card">
          <p>
            Bagi anak yang memerlukan perhatian lebih terarah, Ziel Kids Club menyelenggarakan Pendampingan
            Individual — satu anak satu guru — yang disusun dari hasil observasi dan pemetaan kebutuhan anak,
            termasuk bank sesi pendampingan sesuai area dukungannya. Konsultasikan kebutuhan anak Anda kepada
            admin untuk diarahkan ke jalur yang tepat.
          </p>
        </div>
      </section>
    </>
  );
}
