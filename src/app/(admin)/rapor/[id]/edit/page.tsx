"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { KOLOM_NARASI, NARASI_MONTESSORI, NARASI_STPPA } from "@/lib/rapor-data";
import { useUpload } from "@/components/upload";

const LABEL_TAMBAHAN: Record<string, string> = {
  conclusion: "Kesimpulan",
  parent_suggestion: "Saran untuk Orang Tua",
};

export default function RaporEditPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Array<{ photo_url: string; caption: string }>>([]);
  const upload = useUpload();
  const [status, setStatus] = useState("");
  const [judul, setJudul] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    fetch(`/api/rapor/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Rapor tidak bisa dimuat."); return; }
        const r = d.report as Record<string, unknown>;
        const awal: Record<string, string> = {};
        for (const k of KOLOM_NARASI) awal[k] = String(r[k] ?? "");
        setForm(awal);
        const foto = ((d.photos || []) as Array<Record<string, unknown>>).map((p) => ({
          photo_url: String(p.photo_url ?? ""),
          caption: String(p.caption ?? ""),
        })).filter((p) => p.photo_url);
        setPhotos(foto);
        setStatus(String(r.status ?? ""));
        setJudul(`${String(r.child_name ?? "")} · ${String(r.cycle_theme ?? "")}`);
      })
      .catch(() => setError("Tidak dapat menghubungi server."))
      .finally(() => setSiap(true));
  }, [params.id]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function simpan(terbitkan: boolean) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/rapor/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, photos }),
    });
    const d = await res.json();
    if (!d.ok) {
      setBusy(false);
      setError(d.error || "Gagal menyimpan rapor.");
      return;
    }
    if (terbitkan) {
      const res2 = await fetch(`/api/rapor/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: true }),
      });
      const d2 = await res2.json();
      setBusy(false);
      if (!d2.ok) { setError(d2.error || "Narasi tersimpan, tapi penerbitan gagal."); return; }
      setStatus("published");
      setInfo("Rapor tersimpan dan diterbitkan — sekarang tampil untuk orang tua di Balita Connect.");
      return;
    }
    setBusy(false);
    setInfo("Narasi rapor tersimpan sebagai draft.");
  }

  if (!siap) return (<><PageHead title="Edit Rapor" /><LoadingState /></>);
  if (error && !judul) return (<><PageHead title="Edit Rapor" /><ErrorState message={error} /></>);

  const terkunci = status === "published";

  const grup = (judulGrup: string, daftar: Array<[string, string]>) => (
    <>
      <h2 style={{ marginTop: 24 }}>{judulGrup}</h2>
      {daftar.map(([k, label]) => (
        <div className="field" key={k} style={{ marginTop: 10 }}>
          <label htmlFor={`f-${k}`}>{label}</label>
          <textarea id={`f-${k}`} rows={4} value={form[k] || ""} disabled={terkunci}
            onChange={(e) => set(k, e.target.value)}
            placeholder={`Tulis narasi ${label.toLowerCase()} ananda pada siklus ini…`} />
        </div>
      ))}
    </>
  );

  return (
    <>
      <PageHead
        title="Edit Rapor"
        subtitle={judul}
        action={<Link className="btn secondary" href={`/rapor/${params.id}`}>&larr; Lihat Rapor</Link>}
      />
      <p><StatusBadge status={status} /></p>
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {terkunci ? (
        <p className="notice" role="status">Rapor ini sudah terbit dan terkunci. Tarik dulu ke draft dari halaman Lihat Rapor bila ingin mengubah narasi.</p>
      ) : null}
      <div className="card">
        {grup("Aspek Perkembangan (STPPA)", NARASI_STPPA)}
        {grup("Area Montessori", NARASI_MONTESSORI)}
        {grup("Penutup", [["conclusion", LABEL_TAMBAHAN.conclusion], ["parent_suggestion", LABEL_TAMBAHAN.parent_suggestion]])}

        <h2 style={{ marginTop: 24 }}>Dokumentasi Tambahan</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Foto di sini tampil paling depan di bagian Dokumentasi Kegiatan rapor, melengkapi foto yang
          otomatis terkumpul dari laporan harian terbit pada siklus ini. Maksimal gabungan 6 media.
        </p>
        <div className="field">
          <label htmlFor="foto-rapor">Unggah foto (JPG/PNG/WEBP, maks 5 MB)</label>
          <input id="foto-rapor" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={terkunci || upload.uploading}
            onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              void (async () => {
                for (const file of Array.from(files)) {
                  const hasil = await upload.unggah(file);
                  if (!hasil) return;
                  setPhotos((prev) => [...prev, { photo_url: hasil.url, caption: "" }]);
                }
              })();
              e.target.value = "";
            }} />
          {upload.uploading ? <span className="muted" style={{ fontSize: 12 }}>Mengunggah…</span> : null}
          {upload.error ? <p className="error" role="alert" style={{ fontSize: 13 }}>{upload.error}</p> : null}
        </div>
        {photos.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {photos.map((p, i) => (
              <li key={`${p.photo_url}-${i}`} style={{ border: "1px solid #e3e7ee", borderRadius: 8, padding: 6, width: 168 }}>
                <img src={p.photo_url} alt={`Dokumentasi ${i + 1}`} width={152} height={96} style={{ objectFit: "cover", borderRadius: 4, display: "block", width: "100%" }} />
                <input type="text" placeholder="Keterangan foto" value={p.caption} disabled={terkunci}
                  onChange={(e) => setPhotos((prev) => prev.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
                  style={{ marginTop: 6, width: "100%" }} />
                <button type="button" className="btn small danger" disabled={terkunci} style={{ marginTop: 6, width: "100%" }}
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn secondary" href="/rapor">Batal</Link>
          <button type="button" className="btn secondary" disabled={busy || terkunci} onClick={() => simpan(false)}>{busy ? "Menyimpan…" : "Simpan Draft"}</button>
          <button type="button" className="btn" disabled={busy || terkunci} onClick={() => simpan(true)}>{busy ? "Menyimpan…" : "Simpan & Terbitkan"}</button>
        </div>
      </div>
    </>
  );
}
