"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { ASPEK_MASUKAN, SKALA_MASUKAN } from "@/lib/tahap4";

type Anak = { id: string; full_name: string };
type Masukan = Record<string, unknown> & { id: string; child_id: string; periode: string };

export default function ConnectMasukanPage() {
  const [anak, setAnak] = useState<Anak[]>([]);
  const [masukan, setMasukan] = useState<Masukan[]>([]);
  const [periode, setPeriode] = useState("");
  const [childId, setChildId] = useState("");
  const [aspek, setAspek] = useState<Record<string, string>>({});
  const [cerita, setCerita] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muat, setMuat] = useState(true);

  const load = useCallback(() => {
    fetch("/api/connect/masukan").then((r) => r.json())
      .then((d) => {
        setMuat(false);
        if (!d.ok) { setError(d.error); return; }
        setAnak(d.anak || []);
        setMasukan(d.masukan || []);
        setPeriode(d.periode || "");
        if (d.anak?.length) setChildId((prev) => prev || d.anak[0].id);
      })
      .catch(() => { setMuat(false); setError("Tidak dapat menghubungi server."); });
  }, []);

  useEffect(load, [load]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/connect/masukan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId, aspek, cerita }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Terima kasih — masukan Ayah/Bunda tersimpan dan akan ditindaklanjuti lembaga.");
    setCerita("");
    load();
  }

  if (muat) return (<><PageHead title="Masukan Orang Tua" /><LoadingState /></>);

  return (
    <>
      <PageHead title="Masukan Orang Tua" subtitle={`Penilaian berkala periode ${periode} — dengan kata, tanpa bintang`} />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Ceritakan pengalaman Ayah/Bunda bulan ini. Nilai setiap aspek dengan kata, dan tuliskan cerita bebas
          yang ingin disampaikan — masukan dibaca dan ditindaklanjuti oleh lembaga.
        </p>
        <form onSubmit={kirim}>
          <div className="field"><label htmlFor="mk_anak">Untuk anak</label>
            <select id="mk_anak" value={childId} onChange={(e) => setChildId(e.target.value)}>
              {anak.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select></div>
          {ASPEK_MASUKAN.map(([kunci, label]) => (
            <div className="field" key={kunci}>
              <label htmlFor={`mk_${kunci}`}>{label}</label>
              <select id={`mk_${kunci}`} required value={aspek[kunci] || ""} onChange={(e) => setAspek((p) => ({ ...p, [kunci]: e.target.value }))}>
                <option value="">— Pilih penilaian kata —</option>
                {SKALA_MASUKAN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          ))}
          <div className="field"><label htmlFor="mk_cerita">Cerita bebas</label>
            <textarea id="mk_cerita" rows={4} value={cerita} onChange={(e) => setCerita(e.target.value)} placeholder="Ceritakan pengalaman, apresiasi, atau hal yang perlu diperbaiki…" /></div>
          <button className="btn" type="submit" disabled={busy || !childId} style={{ marginTop: 10 }}>
            {busy ? "Mengirim…" : "Kirim Masukan"}
          </button>
        </form>
      </div>
      {masukan.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Masukan Terkirim</h2>
          {masukan.map((m) => (
            <p key={m.id} style={{ borderTop: "1px solid var(--line, #e5ddd2)", paddingTop: 8 }}>
              <strong>Periode {String(m.periode)}</strong> — {anak.find((a) => a.id === m.child_id)?.full_name || ""}<br />
              <span className="muted">{ASPEK_MASUKAN.map(([k, l]) => `${l}: ${(m.aspek as Record<string, string>)?.[k] || "—"}`).join(" · ")}</span>
              {m.status === "ditindaklanjuti" ? <><br /><span className="badge ok">Sudah ditindaklanjuti lembaga</span></> : null}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
