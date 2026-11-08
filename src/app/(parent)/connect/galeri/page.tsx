"use client";

import { tanggalPanjang } from "@/lib/format";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectGaleriPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Galeri Kegiatan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Galeri Kegiatan" /><LoadingState /></>);

  const activityPhotos = data.activities
    .filter((a) => a.photo_url)
    .map((a) => ({ id: `act-${String(a.id)}`, url: String(a.photo_url), caption: `${String(a.title || "Aktivitas")} · ${String(a.activity_time || "").slice(0, 5)}`, report_date: "", media_type: "image", poster_url: "" }));
  const all = [...data.photos.map((p) => ({ id: String(p.id), url: String(p.url), caption: p.caption || "Dokumentasi laporan harian", report_date: String(p.report_date || ""), media_type: String(p.media_type || "image"), poster_url: p.poster_url ? String(p.poster_url) : "" })), ...activityPhotos];

  return (
    <>
      <PageHead title="Galeri Kegiatan" subtitle="Dokumentasi foto dan video kegiatan anak dari laporan harian yang sudah terbit" />
      {all.length === 0 ? (
        <EmptyState title="Belum ada dokumentasi terbit" body="Foto dan video tampil di sini setelah laporan harian anak diterbitkan dan memuat dokumentasi. Media dari laporan draft atau yang masih direview tidak dibuka untuk orang tua." />
      ) : (
        <div className="gallery-grid">
          {all.map((p) => (
            <figure className="gallery-item" key={p.id} style={{ margin: 0 }}>
              {/* URL media dicatat guru pada laporan; ditampilkan apa adanya */}
              {p.media_type === "video" ? (
                <video src={p.url} poster={p.poster_url || undefined} controls preload="metadata" style={{ width: "100%", display: "block", background: "#000" }} />
              ) : (
                <img src={p.url} alt={p.caption} loading="lazy" />
              )}
              <figcaption>{p.caption}{p.report_date ? ` · ${tanggalPanjang(p.report_date)}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
