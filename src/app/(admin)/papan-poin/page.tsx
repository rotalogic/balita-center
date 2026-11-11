"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { ASPEK_PENILAIAN_GURU } from "@/lib/tahap4";

type Data = Record<string, unknown> & { mode?: string };

export default function PapanPoinPage() {
  const [data, setData] = useState<Data | null>(null);
  const [periode, setPeriode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: string) => {
    fetch(`/api/papan-poin${p ? `?periode=${p}` : ""}`).then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); setData(null); return; }
        setError(null);
        setData(d);
        setPeriode(d.periode || "");
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(() => load(""), [load]);

  return (
    <>
      <PageHead title="Papan Poin Guru" subtitle="Poin internal hasil ubahan penilaian wali murid — bahan KPI bulanan" />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <label htmlFor="pp_periode">Periode (YYYY-MM)</label>
          <input id="pp_periode" value={periode} onChange={(e) => setPeriode(e.target.value)} placeholder="2026-11" style={{ width: 120 }} />
          <button className="btn small secondary" type="button" onClick={() => load(periode)}>Tampilkan</button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Penilaian wali memakai skala kata (Sangat Baik · Baik · Cukup · Perlu Perbaikan) yang diubah sistem menjadi
          poin internal. Poin tidak pernah ditampilkan kepada penilai dan tidak berbentuk bintang. Guru membaca hasil
          penilaiannya sendiri beserta cerita orang tua <strong>tanpa nama penilai</strong>.
        </p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data?.mode === "papan" ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Urutan Guru — Periode {String(data.periode)}</h2>
          {(data.papan as Array<Record<string, unknown>> || []).length === 0 ? (
            <p className="muted">Belum ada penilaian wali pada periode ini.</p>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Guru</th><th>Jumlah Penilai</th><th>Rata-rata Poin Internal</th></tr></thead>
              <tbody>
                {(data.papan as Array<Record<string, unknown>>).map((g, i) => (
                  <tr key={String(g.staff_id)}>
                    <td>{i + 1}</td><td>{String(g.staff_name)}</td>
                    <td>{String(g.jumlah_penilai)}</td><td>{String(g.rata_poin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
      {data?.mode === "sendiri" ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Hasil Penilaian Saya — {String(data.staff_name || "")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{String(data.jumlah_penilai || 0)} wali murid menilai pada periode {String(data.periode)}.</p>
          <dl>
            {ASPEK_PENILAIAN_GURU.map(([k, l]) => (
              <div key={k}>
                <dt className="muted">{l}</dt>
                <dd>{(data.per_aspek as Record<string, number | null>)?.[k] ?? "—"} <span className="muted">(rata-rata poin internal aspek)</span></dd>
              </div>
            ))}
          </dl>
          <h3>Cerita dari orang tua (tanpa nama penilai)</h3>
          {(data.cerita as string[] || []).length === 0 ? <p className="muted">Tidak ada cerita tertulis pada periode ini.</p> : (
            <ul>{(data.cerita as string[]).map((c, i) => <li key={i}>“{c}”</li>)}</ul>
          )}
        </div>
      ) : null}
    </>
  );
}
