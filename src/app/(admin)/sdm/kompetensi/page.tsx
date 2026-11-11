"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { JUMLAH_GUGUS, TINGKAT_KOMPETENSI } from "@/lib/tahap4";

type Staf = { id: string; full_name: string; position: string };
type Penilaian = Record<string, unknown> & { id: string; gugus: Array<{ nama: string; tingkat: number }> };

export default function KompetensiPage() {
  const [staf, setStaf] = useState<Staf[]>([]);
  const [rows, setRows] = useState<Penilaian[] | null>(null);
  const [staffId, setStaffId] = useState("");
  const [semester, setSemester] = useState("");
  const [penilai, setPenilai] = useState("");
  const [gugus, setGugus] = useState<Array<{ nama: string; tingkat: number }>>(
    Array.from({ length: JUMLAH_GUGUS }, () => ({ nama: "", tingkat: 3 }))
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/sdm/kompetensi").then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.penilaian) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/meta").then((r) => r.json())
      .then((d) => { if (d.ok) setStaf(d.staff || []); }).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/sdm/kompetensi", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, semester, penilai_nama: penilai, gugus }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Penilaian kompetensi tersimpan.");
    load();
  }

  return (
    <>
      <PageHead title="Standar & Kompetensi Guru" subtitle="Sepuluh gugus · Tingkat 3 Kompeten adalah standar minimum"
        action={<Link className="btn secondary" href="/sdm">&larr; SDM</Link>} />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Penilaian kompetensi berjalan per semester di samping KPI bulanan. Skala katanya: {Object.values(TINGKAT_KOMPETENSI).join(" · ")}.
          Nama sepuluh gugus mengikuti dokumen Standar Kompetensi Guru lembaga.
        </p>
        <form onSubmit={simpan}>
          <div className="grid-form">
            <div className="field"><label htmlFor="km_staf">Guru yang dinilai *</label>
              <select id="km_staf" required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Pilih guru…</option>
                {staf.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.position}</option>)}
              </select></div>
            <div className="field"><label htmlFor="km_sem">Semester *</label>
              <input id="km_sem" required value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="mis. 2026/2027 Ganjil" /></div>
            <div className="field"><label htmlFor="km_penilai">Nama penilai</label>
              <input id="km_penilai" value={penilai} onChange={(e) => setPenilai(e.target.value)} /></div>
          </div>
          {gugus.map((g, i) => (
            <div className="grid-form" key={i} style={{ marginTop: 6 }}>
              <div className="field"><label htmlFor={`km_g_${i}`}>Gugus {i + 1}</label>
                <input id={`km_g_${i}`} value={g.nama} placeholder="Nama gugus pada dokumen lembaga"
                  onChange={(e) => setGugus((p) => p.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))} /></div>
              <div className="field"><label htmlFor={`km_t_${i}`}>Tingkat</label>
                <select id={`km_t_${i}`} value={g.tingkat}
                  onChange={(e) => setGugus((p) => p.map((x, j) => (j === i ? { ...x, tingkat: Number(e.target.value) } : x)))}>
                  {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{TINGKAT_KOMPETENSI[t]}</option>)}
                </select></div>
            </div>
          ))}
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Menyimpan…" : "Simpan Penilaian"}</button>
        </form>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Riwayat Penilaian</h2>
        {rows === null ? <LoadingState /> : rows.length === 0 ? <p className="muted">Belum ada penilaian kompetensi.</p> : (
          <table>
            <thead><tr><th>Guru</th><th>Semester</th><th>Di Bawah Tingkat 3</th><th>Ringkasan</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const bawah = (r.gugus || []).filter((g) => g.tingkat < 3);
                return (
                  <tr key={r.id}>
                    <td>{String(r.staff_name)}</td><td>{String(r.semester)}</td>
                    <td>{bawah.length ? <span className="badge warn">{bawah.length} gugus</span> : <span className="badge ok">Semua ≥ Tingkat 3</span>}</td>
                    <td className="muted">{(r.gugus || []).map((g) => `${g.nama}: T${g.tingkat}`).join(" · ").slice(0, 140)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
