"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";

type Kelas = { id: string; name: string; branch_id: string };
type Baris = {
  id: string; tanggal: string; class_name: string | null; penulis_nama: string;
  dipelajari: string; perubahan: string; kesadaran: string;
};

const hariIni = () => new Date().toISOString().slice(0, 10);

export default function RefleksiPage() {
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [pembina, setPembina] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ tanggal: hariIni(), class_id: "", dipelajari: "", perubahan: "", kesadaran: "" });

  const load = useCallback(() => {
    fetch("/api/refleksi")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        setBaris(d.refleksi);
        setPembina(Boolean(d.pembina));
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setKelas(d.classes || []); })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function simpan() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/refleksi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, class_id: f.class_id || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Refleksi hari ini tersimpan.");
    setF({ ...f, dipelajari: "", perubahan: "", kesadaran: "" });
    load();
  }

  return (
    <>
      <PageHead
        title="Refleksi Guru"
        subtitle="Refleksi harian guide untuk kelas atau kelompoknya — bahan pembinaan founder dan manager, tidak tampil kepada orang tua"
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Refleksi Hari Ini</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="rf_tgl">Tanggal *</label>
            <input id="rf_tgl" type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></div>
          <div className="field"><label htmlFor="rf_kelas">Kelas / kelompok</label>
            <select id="rf_kelas" value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
              <option value="">Umum (tanpa kelas)</option>
              {kelas.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="rf_pelajari">Yang saya pelajari tentang anak &amp; lingkungan *</label>
            <textarea id="rf_pelajari" rows={3} value={f.dipelajari} onChange={(e) => setF({ ...f, dipelajari: e.target.value })} /></div>
          <div className="field"><label htmlFor="rf_ubah">Perubahan yang perlu dilakukan *</label>
            <textarea id="rf_ubah" rows={3} value={f.perubahan} onChange={(e) => setF({ ...f, perubahan: e.target.value })} placeholder="Pada prepared environment atau cara saya mendampingi" /></div>
          <div className="field"><label htmlFor="rf_sadar">Kesadaran diri saya sebagai guide *</label>
            <textarea id="rf_sadar" rows={3} value={f.kesadaran} onChange={(e) => setF({ ...f, kesadaran: e.target.value })} /></div>
        </div>
        <button className="btn" type="button" disabled={busy} style={{ marginTop: 10 }} onClick={() => void simpan()}>
          {busy ? "Menyimpan…" : "Simpan Refleksi"}
        </button>
        <p className="muted">
          Hasil olahan refleksi boleh mengalir ke bagian Catatan pada laporan SAM; naskah mentahnya
          tetap internal dan tidak pernah tampil kepada orang tua.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>{pembina ? "Refleksi Semua Guide (Pembinaan)" : "Refleksi Saya"}</h2>
        {baris === null ? <LoadingState /> : baris.length === 0 ? (
          <EmptyState title="Belum ada refleksi" body="Refleksi tampil di sini sesudah guide mengisinya." />
        ) : (
          baris.map((b) => (
            <article key={b.id} style={{ borderTop: "1px solid #e8e2d6", padding: "10px 0" }}>
              <p style={{ margin: "0 0 4px" }}>
                <strong>{tanggalPanjang(b.tanggal)}</strong> · {b.penulis_nama}
                {b.class_name ? <> · {b.class_name}</> : null}
              </p>
              <p style={{ margin: "4px 0" }}><span className="muted">Dipelajari:</span> {b.dipelajari}</p>
              <p style={{ margin: "4px 0" }}><span className="muted">Perubahan:</span> {b.perubahan}</p>
              <p style={{ margin: "4px 0" }}><span className="muted">Kesadaran diri:</span> {b.kesadaran}</p>
            </article>
          ))
        )}
      </div>
    </>
  );
}
