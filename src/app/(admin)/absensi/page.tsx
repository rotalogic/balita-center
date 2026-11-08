"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";

type Anak = { id: string; full_name: string; status: string | null };
type Kelas = { id: string; name: string };

const PILIHAN: Array<[string, string]> = [
  ["hadir", "Hadir"],
  ["izin", "Izin"],
  ["sakit", "Sakit"],
  ["alpa", "Alpa"],
];

export default function AbsensiPage() {
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [children, setChildren] = useState<Anak[]>([]);
  const [kelas, setKelas] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const muat = useCallback((classId: string, date: string) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (classId) qs.set("class_id", classId);
    if (date) qs.set("date", date);
    fetch(`/api/attendance?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error);
          return;
        }
        setClasses(d.classes || []);
        setChildren(d.children || []);
        const awal: Record<string, string> = {};
        for (const anak of d.children || []) awal[anak.id] = anak.status || "hadir";
        setStatus(awal);
        setError(null);
      })
      .catch(() => setError("Tidak dapat menghubungi server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    muat(kelas, tanggal);
  }, [muat, kelas, tanggal]);

  async function simpan() {
    if (!kelas) return setError("Pilih kelas dulu.");
    setBusy(true);
    setError(null);
    setInfo(null);
    const entries = Object.entries(status).map(([child_id, s]) => ({ child_id, status: s }));
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: kelas, date: tanggal, entries }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) return setError(d.error || "Gagal menyimpan absensi.");
    setInfo(`Absensi tersimpan: ${d.tersimpan} anak, ${d.hadir} hadir.`);
    muat(kelas, tanggal); // segarkan status & penghitung tanpa reload manual
  }

  function tandaiSemua(nilai: string) {
    const baru: Record<string, string> = {};
    for (const anak of children) baru[anak.id] = nilai;
    setStatus(baru);
  }

  if (error && classes.length === 0) return (<><PageHead title="Absensi" /><ErrorState message={error} /></>);
  if (loading && classes.length === 0) return (<><PageHead title="Absensi" /><LoadingState /></>);

  return (
    <>
      <PageHead title="Absensi" subtitle="Catat kehadiran anak per kelas dan tanggal" />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <div className="form-grid">
          <div className="field"><label htmlFor="ab_kelas">Kelas</label>
            <select id="ab_kelas" value={kelas} onChange={(e) => setKelas(e.target.value)}>
              <option value="">Pilih kelas</option>
              {classes.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="ab_tgl">Tanggal</label>
            <input id="ab_tgl" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></div>
        </div>
        {children.length > 0 ? (
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn small secondary" onClick={() => tandaiSemua("hadir")}>Tandai semua Hadir</button>
            <button type="button" className="btn small secondary" onClick={() => tandaiSemua("alpa")}>Tandai semua Alpa</button>
          </div>
        ) : null}
      </div>

      {!kelas ? (
        <div style={{ marginTop: 16 }}><EmptyState title="Pilih kelas" body="Absensi ditampilkan per kelas. Pilih kelas dan tanggal di atas." /></div>
      ) : loading ? (
        <div style={{ marginTop: 16 }}><LoadingState /></div>
      ) : children.length === 0 ? (
        <div style={{ marginTop: 16 }}><EmptyState title="Belum ada anak di kelas ini" body="Daftarkan anak ke kelas lewat menu Anak Didik → Tambah Anak." /></div>
      ) : (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Nama anak</th><th>Status</th></tr></thead>
            <tbody>
              {children.map((anak) => (
                <tr key={anak.id}>
                  <td><strong>{anak.full_name}</strong></td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {PILIHAN.map(([kode, label]) => (
                        <button
                          key={kode}
                          type="button"
                          className={`btn small ${status[anak.id] === kode ? "" : "secondary"}`}
                          aria-pressed={status[anak.id] === kode}
                          onClick={() => setStatus({ ...status, [anak.id]: kode })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={simpan} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Absensi"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
