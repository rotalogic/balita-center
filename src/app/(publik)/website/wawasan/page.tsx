"use client";

import Link from "next/link";
import { usePublik } from "@/components/publik-data";

export default function WawasanPage() {
  const data = usePublik();
  return (
    <>
      <section className="pb-hero">
        <h1>Wawasan — Blog &amp; Edukasi Orang Tua</h1>
        <p className="tag">Tulisan pendiri dan tim untuk menemani orang tua memahami anaknya.</p>
      </section>
      <section className="pb-sec">
        {!data ? <p>Sedang memuat artikel…</p> : (
          <div className="pb-grid">
            {data.artikel.map((a) => (
              <article className="pb-card" key={a.slug}>
                <p style={{ margin: "0 0 6px" }}>
                  <span className="pb-badge">{a.kategori || "Wawasan"}</span>{" "}
                  <span style={{ color: "#57462f", fontSize: 13 }}>
                    {a.tanggal_terbit ? new Date(`${a.tanggal_terbit}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
                  </span>
                </p>
                <h3>{a.judul}</h3>
                <p style={{ marginTop: 8 }}><Link className="pb-btn garis" href={`/website/wawasan/${a.slug}`}>Baca Artikel</Link></p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
