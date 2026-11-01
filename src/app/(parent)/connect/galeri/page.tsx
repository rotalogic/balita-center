"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectGaleriPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Galeri Kegiatan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Galeri Kegiatan" /><LoadingState /></>);

  const activityPhotos = data.activities
    .filter((a) => a.photo_url)
    .map((a) => ({ id: `act-${String(a.id)}`, url: String(a.photo_url), caption: `${String(a.title || "Aktivitas")} · ${String(a.activity_time || "").slice(0, 5)}`, report_date: "" }));
  const all = [...data.photos.map((p) => ({ id: String(p.id), url: String(p.url), caption: p.caption || "Dokumentasi laporan harian", report_date: String(p.report_date || "") })), ...activityPhotos];

  return (
    <>
      <PageHead title="Galeri Kegiatan" subtitle="Dokumentasi foto kegiatan anak dari laporan harian yang sudah terbit" />
      {all.length === 0 ? (
        <EmptyState title="Belum ada foto terbit" body="Foto tampil di sini setelah laporan harian anak diterbitkan dan memuat dokumentasi. Foto dari laporan draft atau yang masih direview tidak dibuka untuk orang tua." />
      ) : (
        <div className="gallery-grid">
          {all.map((p) => (
            <figure className="gallery-item" key={p.id} style={{ margin: 0 }}>
              {/* URL media dicatat guru pada laporan; ditampilkan apa adanya */}
              <img src={p.url} alt={p.caption} loading="lazy" />
              <figcaption>{p.caption}{p.report_date ? ` · ${p.report_date}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
