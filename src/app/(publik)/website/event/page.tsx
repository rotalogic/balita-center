import { SeksiEvent } from "@/components/publik-data";

export default function EventPage() {
  return (
    <>
      <section className="pb-hero">
        <h1>Event &amp; Kegiatan Terdekat</h1>
        <p className="tag">Pop up class, seminar, dan kegiatan alam dari kedua rumah — berjalan rutin sepanjang tahun.</p>
      </section>
      <section className="pb-sec">
        <SeksiEvent />
      </section>
    </>
  );
}
