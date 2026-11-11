"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState, PageHead } from "@/components/chrome";

type Entri = { id: string; tanggal: string; judul: string; lapis: string; keterangan: string | null };

const LAPIS: Record<string, { label: string; warna: string }> = {
  momen: { label: "Momen & Ritme Lembaga", warna: "#8A6844" },
  pembelajaran: { label: "Pembelajaran ZKC & Kurikulum SAM", warna: "#4F7A54" },
  dapodik: { label: "Acuan Pendidikan & Batas Dapodik", warna: "#31537f" },
};
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function KalenderPage() {
  const kini = new Date();
  const [tahun, setTahun] = useState(kini.getFullYear());
  const [bulan, setBulan] = useState(kini.getMonth());
  const [entri, setEntri] = useState<Entri[]>([]);
  const [f, setF] = useState({ tanggal: "", judul: "", lapis: "momen", keterangan: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/kalender").then((r) => r.json())
      .then((d) => (d.ok ? setEntri(d.entri) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  const sel = useMemo(() => {
    const pertama = new Date(tahun, bulan, 1);
    const mulai = new Date(pertama);
    mulai.setDate(1 - ((pertama.getDay() + 6) % 7)); // mulai Senin
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(mulai);
      d.setDate(mulai.getDate() + i);
      return d;
    });
  }, [tahun, bulan]);

  const perTanggal = useMemo(() => {
    const peta = new Map<string, Entri[]>();
    for (const e of entri) {
      const arr = peta.get(e.tanggal) || [];
      arr.push(e);
      peta.set(e.tanggal, arr);
    }
    return peta;
  }, [entri]);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/kalender", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Entri kalender ditambahkan.");
    setF({ tanggal: "", judul: "", lapis: "momen", keterangan: "" });
    load();
  }

  async function hapus(id: string) {
    setBusy(true);
    await fetch(`/api/kalender?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  return (
    <>
      <PageHead title="Kalender Lembaga" subtitle="Tiga lapisan berdampingan: momen lembaga · pembelajaran · acuan pendidikan & Dapodik" />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="row" style={{ gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        {Object.entries(LAPIS).map(([k, v]) => (
          <span key={k}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: v.warna, marginRight: 6 }} />{v.label}</span>
        ))}
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn secondary" type="button" onClick={() => { if (bulan === 0) { setBulan(11); setTahun(tahun - 1); } else setBulan(bulan - 1); }}>&larr; Bulan Lalu</button>
          <h2 style={{ margin: 0 }}>{NAMA_BULAN[bulan]} {tahun}</h2>
          <button className="btn secondary" type="button" onClick={() => { if (bulan === 11) { setBulan(0); setTahun(tahun + 1); } else setBulan(bulan + 1); }}>Bulan Berikut &rarr;</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 12 }}>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((h) => <div key={h} className="muted" style={{ textAlign: "center", fontWeight: 600 }}>{h}</div>)}
          {sel.map((d) => {
            const key = iso(d);
            const daftar = perTanggal.get(key) || [];
            const bulanIni = d.getMonth() === bulan;
            return (
              <div key={key} style={{ minHeight: 74, border: "1px solid var(--line, #e5ddd2)", borderRadius: 8, padding: 4, opacity: bulanIni ? 1 : 0.45, background: key === iso(new Date()) ? "#fdf6ec" : undefined }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{d.getDate()}</div>
                {daftar.map((e) => (
                  <div key={e.id} title={e.keterangan || e.judul} style={{ fontSize: 11, background: LAPIS[e.lapis]?.warna, color: "#fff", borderRadius: 4, padding: "1px 4px", marginTop: 2 }}>
                    {e.judul}
                    <button type="button" aria-label={`Hapus ${e.judul}`} disabled={busy} onClick={() => void hapus(e.id)}
                      style={{ float: "right", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tambah Entri</h2>
        <form onSubmit={tambah}>
          <div className="grid-form">
            <div className="field"><label htmlFor="kl_tgl">Tanggal *</label>
              <input id="kl_tgl" type="date" required value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></div>
            <div className="field"><label htmlFor="kl_lapis">Lapis kalender *</label>
              <select id="kl_lapis" value={f.lapis} onChange={(e) => setF({ ...f, lapis: e.target.value })}>
                {Object.entries(LAPIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div className="field"><label htmlFor="kl_judul">Judul *</label>
              <input id="kl_judul" required value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} /></div>
            <div className="field"><label htmlFor="kl_ket">Keterangan</label>
              <input id="kl_ket" value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} /></div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Menyimpan…" : "Tambah ke Kalender"}</button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          Kalender momen lembaga berjalan sampai Desember 2027; lapisan acuan memuat kalender pendidikan Tahun Ajaran
          2026/2027 dan tanggal batas Dapodik sebagai pengingat administrasi — isinya diisi lembaga dari dokumen resminya.
        </p>
      </div>
    </>
  );
}
