"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { kirimJson } from "@/lib/http";

// Absensi guru & staf: status resmi Hadir, Terlambat, Izin, Sakit, Cuti
// beserta jam hadir, dengan rekap bulanan untuk SDM. Pendamping absensi
// anak yang tercatat per kelas.

type Baris = {
  id: string; full_name: string; position: string | null; branch_name: string | null;
  status: string | null; jam_masuk: string | null; catatan: string | null;
};
type Rekap = {
  id: string; full_name: string; position: string | null; branch_name: string | null;
  hadir: number; terlambat: number; izin: number; sakit: number; cuti: number;
};

const STATUS: Array<[string, string]> = [
  ["hadir", "Hadir"],
  ["terlambat", "Terlambat"],
  ["izin", "Izin"],
  ["sakit", "Sakit"],
  ["cuti", "Cuti"],
];

const hariIni = () => new Date().toISOString().slice(0, 10);
const bulanIni = () => new Date().toISOString().slice(0, 7);

export function AbsensiGuruClient() {
  const [tanggal, setTanggal] = useState(hariIni());
  const [roster, setRoster] = useState<Baris[] | null>(null);
  const [draf, setDraf] = useState<Record<string, { status: string; jam_masuk: string; catatan: string }>>({});
  const [bulan, setBulan] = useState(bulanIni());
  const [rekap, setRekap] = useState<Rekap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    setError(null);
    const r = await fetch(`/api/absensi-guru?tanggal=${tanggal}`);
    const d = await r.json();
    if (!d.ok) { setError(d.error || "Gagal memuat absensi guru."); return; }
    const baris = (d.roster as Baris[]) || [];
    setRoster(baris);
    const awal: Record<string, { status: string; jam_masuk: string; catatan: string }> = {};
    for (const b of baris) {
      awal[b.id] = {
        status: b.status || "",
        jam_masuk: b.jam_masuk ? String(b.jam_masuk).slice(0, 5) : "",
        catatan: b.catatan || "",
      };
    }
    setDraf(awal);
  }, [tanggal]);

  const muatRekap = useCallback(async () => {
    const r = await fetch(`/api/absensi-guru?rekap=${bulan}`);
    const d = await r.json();
    if (d.ok) setRekap((d.rekap as Rekap[]) || []);
  }, [bulan]);

  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => { void muatRekap(); }, [muatRekap]);

  const setBaris = (id: string, patch: Partial<{ status: string; jam_masuk: string; catatan: string }>) =>
    setDraf((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function simpan() {
    if (!roster) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const entries = roster
      .filter((b) => draf[b.id]?.status)
      .map((b) => ({ staff_id: b.id, status: draf[b.id].status, jam_masuk: draf[b.id].jam_masuk, catatan: draf[b.id].catatan }));
    const { ok, data: d } = await kirimJson("/api/absensi-guru", "POST", { tanggal, entries });
    setBusy(false);
    if (!ok) return setError(String(d.error || "Gagal menyimpan absensi."));
    setInfo(`Absensi ${tanggal} tersimpan untuk ${d.tersimpan} staf.`);
    void muat();
    void muatRekap();
  }

  return (
    <>
      <PageHead title="Absensi Guru" subtitle="Kehadiran guru & staf per tanggal, dengan rekap bulanan untuk SDM" />
      <div className="row" style={{ marginBottom: 12 }}>
        <a className="btn secondary" href="/absensi">Absensi Anak</a>
        <a className="btn" href="/absensi/guru">Absensi Guru</a>
        <a className="btn secondary" href="/sdm/cuti">Cuti / Izin / Lembur</a>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      <article className="card">
        <div className="row spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ag-tanggal">Tanggal</label>
            <input id="ag-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="row">
            <button type="button" className="btn secondary" disabled={!roster}
              onClick={() => roster?.forEach((b) => setBaris(b.id, { status: "hadir" }))}>
              Tandai Semua Hadir
            </button>
            <button type="button" className="btn" disabled={busy || !roster} onClick={() => void simpan()}>
              {busy ? "Menyimpan…" : "Simpan Absensi"}
            </button>
          </div>
        </div>
        {!roster ? <LoadingState /> : roster.length === 0 ? (
          <EmptyState title="Belum ada data staf" body="Staf yang tercatat di menu SDM akan tampil di sini untuk dicatat kehadirannya." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr><th>Nama</th><th>Status</th><th>Jam Hadir</th><th>Catatan</th></tr>
              </thead>
              <tbody>
                {roster.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.full_name}</strong>
                      <div className="muted">{[b.position, b.branch_name].filter(Boolean).join(" · ") || "-"}</div>
                    </td>
                    <td>
                      <div className="choice-row">
                        {STATUS.map(([v, label]) => (
                          <button type="button" key={v} className={draf[b.id]?.status === v ? "choice selected" : "choice"}
                            aria-pressed={draf[b.id]?.status === v}
                            onClick={() => setBaris(b.id, { status: v })}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      {draf[b.id]?.status === "hadir" || draf[b.id]?.status === "terlambat" ? (
                        <input type="time" aria-label={`Jam hadir ${b.full_name}`} value={draf[b.id]?.jam_masuk || ""}
                          onChange={(e) => setBaris(b.id, { jam_masuk: e.target.value })} />
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <input aria-label={`Catatan ${b.full_name}`} value={draf[b.id]?.catatan || ""} placeholder="Catatan"
                        onChange={(e) => setBaris(b.id, { catatan: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="row spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Rekap Bulanan</h2>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ag-bulan">Bulan</label>
            <input id="ag-bulan" type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} />
          </div>
        </div>
        {!rekap ? <LoadingState /> : rekap.length === 0 ? (
          <EmptyState title="Belum ada data staf" body="Rekap mengikuti data staf dan absensi yang tercatat." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr><th>Nama</th><th>Hadir</th><th>Terlambat</th><th>Izin</th><th>Sakit</th><th>Cuti</th></tr>
              </thead>
              <tbody>
                {rekap.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.full_name}</strong><div className="muted">{[r.position, r.branch_name].filter(Boolean).join(" · ") || "-"}</div></td>
                    <td>{r.hadir}</td><td>{r.terlambat}</td><td>{r.izin}</td><td>{r.sakit}</td><td>{r.cuti}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginBottom: 0 }}>
          Pengajuan cuti dan persetujuannya tetap berjalan di menu SDM → Cuti / Izin / Lembur; rekap ini membaca catatan kehadiran harian di halaman ini.
        </p>
      </article>
    </>
  );
}
