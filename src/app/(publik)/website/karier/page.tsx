import KarierFormDanKartu from "./karier-form";

export default function KarierPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Karier</h1>
        <p className="tag">Bertumbuh bersama anak-anak — bergabunglah dengan tim guru dan guide kami.</p>
      </section>
      <section className="pb-sec">
        <KarierFormDanKartu />
      </section>
    </>
  );
}
