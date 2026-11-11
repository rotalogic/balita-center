import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Artikel Wawasan utuh — isi artikel adalah bahan lembaga; halaman artikel
// yang isinya belum tersedia tidak menampilkan ruang kosong, melainkan
// keterangan bahwa artikel sedang disiapkan (susunan halaman tidak berubah).
export default async function ArtikelPage({ params }: { params: { slug: string } }) {
  const rows = await query<{ judul: string; kategori: string | null; tanggal_terbit: string | null; isi: string | null }>(
    "SELECT judul, kategori, tanggal_terbit::text AS tanggal_terbit, isi FROM artikel WHERE slug = $1",
    [params.slug]
  );
  if (rows.length === 0) notFound();
  const a = rows[0];
  return (
    <>
      <section className="pb-hero">
        <p style={{ margin: "0 0 6px" }}>
          <span className="pb-badge">{a.kategori || "Wawasan"}</span>{" "}
          <span style={{ color: "#57462f", fontSize: 13.5 }}>
            {a.tanggal_terbit ? new Date(`${a.tanggal_terbit}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </span>
        </p>
        <h1 style={{ fontSize: 27 }}>{a.judul}</h1>
      </section>
      <section className="pb-sec">
        <div className="pb-card">
          {a.isi ? (
            a.isi.split(/\n{2,}/).map((par, i) => (
              <p key={i} style={{ marginBottom: 12, lineHeight: 1.7 }}>{par}</p>
            ))
          ) : (
            <p>
              Artikel ini sedang disiapkan oleh pendiri dan tim lembaga, dan akan terbit utuh di halaman ini.
              Sementara itu, Ayah/Bunda dapat mengenal pendekatan kami lewat halaman program kedua rumah.
            </p>
          )}
          <p style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="pb-btn" href="/website/bergabung">Kenali Program Lembaga</Link>
            <Link className="pb-btn garis" href="/website/wawasan">Artikel Lainnya</Link>
          </p>
        </div>
      </section>
    </>
  );
}
