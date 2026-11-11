"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { ASPEK_PENILAIAN_GURU, SKALA_MASUKAN } from "@/lib/tahap4";

type Pasangan = { child_id: string; child_name: string; staff_id: string; staff_name: string; class_name: string };

export default function ConnectPenilaianGuruPage() {
  const [pasangan, setPasangan] = useState<Pasangan[]>([]);
  const [periode, setPeriode] = useState("");
  const [pilih, setPilih] = useState("");
  const [aspek, setAspek] = useState<Record<string, string>>({});
  const [cerita, setCerita] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muat, setMuat] = useState(true);

  const load = useCallback(() => {
    fetch("/api/connect/penilaian").then((r) => r.json())
      .then((d) => {
        setMuat(false);
        if (!d.ok) { setError(d.error); return; }
        setPasangan(d.guru_anak || []);
        setPeriode(d.periode || "");
        if (d.guru_anak?.length) setPilih((p) => p || `${d.guru_anak[0].child_id}|${d.guru_anak[0].staff_id}`);
      })
      .catch(() => { setMuat(false); setError("Tidak dapat menghubungi server."); });
  }, []);

  useEffect(load, [load]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const [child_id, staff_id] = pilih.split("|");
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/connect/penilaian", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id, staff_id, aspek, cerita }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Terima kasih — penilaian Ayah/Bunda tersimpan. Guru membaca hasilnya tanpa nama penilai.");
    setCerita("");
    load();
  }

  if (muat) return (<><PageHead title="Penilaian Guru" /><LoadingState /></>);

  return (
    <>
      <PageHead title="Penilaian Guru oleh Wali Murid" subtitle={`Periode ${periode} — empat aspek, skala kata, tanpa bintang`} />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="card">
        {pasangan.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Belum ada guru kelas yang terhubung dengan anak Ayah/Bunda pada periode ini.</p>
        ) : (
          <form onSubmit={kirim}>
            <div className="field"><label htmlFor="pg_pilih">Guru kelas yang dinilai</label>
              <select id="pg_pilih" value={pilih} onChange={(e) => setPilih(e.target.value)}>
                {pasangan.map((p) => (
                  <option key={`${p.child_id}|${p.staff_id}`} value={`${p.child_id}|${p.staff_id}`}>
                    {p.staff_name} — guru {p.child_name} ({p.class_name})
                  </option>
                ))}
              </select></div>
            {ASPEK_PENILAIAN_GURU.map(([kunci, label]) => (
              <div className="field" key={kunci}>
                <label htmlFor={`pg_${kunci}`}>{label}</label>
                <select id={`pg_${kunci}`} required value={aspek[kunci] || ""} onChange={(e) => setAspek((p) => ({ ...p, [kunci]: e.target.value }))}>
                  <option value="">— Pilih penilaian kata —</option>
                  {SKALA_MASUKAN.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            ))}
            <div className="field"><label htmlFor="pg_cerita">Cerita untuk guru (tanpa nama penilai saat dibaca guru)</label>
              <textarea id="pg_cerita" rows={3} value={cerita} onChange={(e) => setCerita(e.target.value)} /></div>
            <button className="btn" type="submit" disabled={busy || !pilih} style={{ marginTop: 10 }}>
              {busy ? "Mengirim…" : "Kirim Penilaian"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
