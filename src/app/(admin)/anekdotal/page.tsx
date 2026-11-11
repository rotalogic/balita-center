"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { FOKUS_AMATI, LABEL_FOKUS } from "@/lib/segmen";

type Anak = { id: string; full_name: string; kategori_program?: string };
type Baris = {
  id: string; child_name: string; usia_bulan: number | null; tanggal: string;
  fokus_amati: string; kejadian: string; interpretasi: string; tindak_lanjut: string;
  penulis_nama: string | null;
};

const hariIni = () => new Date().toISOString().slice(0, 10);

export default function AnekdotalPage() {
  const [anak, setAnak] = useState<Anak[]>([]);
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterAnak, setFilterAnak] = useState("");
  const [f, setF] = useState({
    child_id: "", tanggal: hariIni(), fokus_amati: "material",
    kejadian: "", interpretasi: "", tindak_lanjut: "",
  });

  const load = useCallback(() => {
    const q = filterAnak ? `?child_id=${filterAnak}` : "";
    fetch(`/api/anekdotal${q}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setBaris(d.anekdotal) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [filterAnak]);

  useEffect(() => {
    fetch("/api/children")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setAnak(d.children); })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function simpan() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/anekdotal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Catatan anekdotal tersimpan.");
    setF({ ...f, kejadian: "", interpretasi: "", tindak_lanjut: "" });
    load();
  }

  async function hapus(id: string) {
    if (!window.confirm("Hapus catatan anekdotal ini?")) return;
    const res = await fetch(`/api/anekdotal/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!d.ok) { setError(d.error); return; }
    load();
  }

  return (
    <>
      <PageHead
        title="Anekdotal Record SAM"
        subtitle="Observasi harian lima kolom: kejadian faktual, interpretasi bahasa Montessori, tindak lanjut konkret — satu penanda Fokus Amati per catatan"
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Catatan Baru</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="an_anak">Anak *</label>
            <select id="an_anak" value={f.child_id} onChange={(e) => setF({ ...f, child_id: e.target.value })}>
              <option value="">Pilih anak…</option>
              {anak.map((c) => (<option key={c.id} value={c.id}>{c.full_name}{c.kategori_program ? ` (${c.kategori_program})` : ""}</option>))}
            </select></div>
          <div className="field"><label htmlFor="an_tgl">Tanggal *</label>
            <input id="an_tgl" type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></div>
          <div className="field"><label htmlFor="an_fokus">Fokus Amati *</label>
            <select id="an_fokus" value={f.fokus_amati} onChange={(e) => setF({ ...f, fokus_amati: e.target.value })}>
              {FOKUS_AMATI.map((x) => (<option key={x.kunci} value={x.kunci}>{x.label}</option>))}
            </select></div>
          <div className="field"><label htmlFor="an_kejadian">Kejadian (faktual, apa adanya) *</label>
            <textarea id="an_kejadian" rows={3} value={f.kejadian} onChange={(e) => setF({ ...f, kejadian: e.target.value })} placeholder="Tulis yang terlihat dan terdengar, tanpa penilaian" /></div>
          <div className="field"><label htmlFor="an_tafsir">Interpretasi (bahasa Montessori) *</label>
            <textarea id="an_tafsir" rows={3} value={f.interpretasi} onChange={(e) => setF({ ...f, interpretasi: e.target.value })} placeholder="Bacaan guide: masa peka, normalisasi, kebutuhan anak" /></div>
          <div className="field"><label htmlFor="an_lanjut">Tindak Lanjut (langkah konkret guide) *</label>
            <textarea id="an_lanjut" rows={3} value={f.tindak_lanjut} onChange={(e) => setF({ ...f, tindak_lanjut: e.target.value })} placeholder="Termasuk tawaran presentasi berikutnya pada peta material anak bila anekdotnya tentang material" /></div>
        </div>
        <button className="btn" type="button" disabled={busy} style={{ marginTop: 10 }} onClick={() => void simpan()}>
          {busy ? "Menyimpan…" : "Simpan Catatan Anekdotal"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Catatan Terakhir</h2>
          <select value={filterAnak} onChange={(e) => setFilterAnak(e.target.value)} aria-label="Saring per anak">
            <option value="">Semua anak</option>
            {anak.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}
          </select>
        </div>
        {baris === null ? <LoadingState /> : baris.length === 0 ? (
          <EmptyState title="Belum ada catatan" body="Catatan anekdotal tampil di sini sesudah guide mengisinya." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Nama + Usia</th><th>Kejadian</th><th>Interpretasi</th><th>Tindak Lanjut</th><th></th></tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{tanggalPanjang(b.tanggal)}<br /><span className="badge info">{LABEL_FOKUS[b.fokus_amati] || b.fokus_amati}</span></td>
                    <td><strong>{b.child_name}</strong>{b.usia_bulan !== null ? <><br /><span className="muted">{b.usia_bulan} bulan</span></> : null}</td>
                    <td>{b.kejadian}</td>
                    <td>{b.interpretasi}</td>
                    <td>{b.tindak_lanjut}</td>
                    <td><button className="btn small danger" type="button" onClick={() => void hapus(b.id)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
