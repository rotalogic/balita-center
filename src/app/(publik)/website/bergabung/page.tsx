import BergabungForm from "./bergabung-form";
import { KALIMAT_KONSULTASI_GRATIS, WA_LINK } from "@/lib/publik";

export default function BergabungPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Bergabung</h1>
        <p className="tag">Satu formulir ringan untuk kelas, program, event, skrining, dan konsultasi.</p>
        <p style={{ color: "#57462f", fontStyle: "italic" }}>{KALIMAT_KONSULTASI_GRATIS}</p>
      </section>
      <section className="pb-sec">
        <div className="pb-card">
          <BergabungForm />
        </div>
        <p style={{ color: "#57462f", marginTop: 14 }}>
          Lebih suka bertanya dulu? <a href={WA_LINK} target="_blank" rel="noreferrer">Hubungi admin lewat tombol WhatsApp</a> — tautan polos tanpa pesan terisi otomatis.
        </p>
      </section>
    </>
  );
}
