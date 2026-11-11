"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { ASPEK_MASUKAN, BIDANG_MASUKAN, CERITA_MASUKAN, KUNCI_REKOMENDASI, SKALA_MASUKAN, SKALA_REKOMENDASI } from "@/lib/tahap4";

type Anak = { id: string; full_name: string };
type Masukan = Record<string, unknown> & { id: string; child_id: string; periode: string };

export default function ConnectMasukanPage() {
  const [anak, setAnak] = useState<Anak[]>([]);
  const [masukan, setMasukan] = useState<Masukan[]>([]);
  const [periode, setPeriode] = useState("");
  const [childId, setChildId] = useState("");
  const [aspek, setAspek] = useState<Record<string, string>>({});
  const [isiCerita, setIsiCerita] = useState<Record<string, string>>({});
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
    const cerita = CERITA_MASUKAN
      .map(([k, l]) => (isiCerita[k] || "").trim() ? `${l}: ${isiCerita[k].trim()}` : "")
      .filter(Boolean).join("\n\n");
    const res = await fetch("/api/connect/masukan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId, aspek, cerita }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Terima kasih — masukan Ayah/Bunda tersimpan dan akan ditindaklanjuti lembaga.");
    setIsiCerita({});
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
          Formulir resmi lembaga: nilai setiap pernyataan per bidang dengan kata, ceritakan dengan kata-kata
          Ayah/Bunda, lalu tutup dengan penilaian rekomendasi. Masukan dibaca, direkap, dan ditindaklanjuti;
          ringkasan tindak lanjutnya disampaikan kembali kepada seluruh orang tua setiap periode.
        </p>
        <form onSubmit={kirim}>
          <div className="field"><label htmlFor="mk_anak">Untuk anak</label>
            <select id="mk_anak" value={childId} onChange={(e) => setChildId(e.target.value)}>
              {anak.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select></div>
          {BIDANG_MASUKAN.map((b) => (
            <fieldset key={b.bidang} style={{ border: "1px solid var(--line, #e5ddd2)", borderRadius: 8, margin: "0 0 14px", padding: "10px 14px" }}>
              <legend style={{ fontWeight: 600, padding: "0 6px" }}>{b.bidang}</legend>
              {b.pernyataan.map(([kunci, label]) => (
                <div className="field" key={kunci}>
                  <label htmlFor={`mk_${kunci}`}>{label}</label>
                  <select id={`mk_${kunci}`} required value={aspek[kunci] || ""} onChange={(e) => setAspek((p) => ({ ...p, [kunci]: e.target.value }))}>
                    <option value="">— Pilih penilaian kata —</option>
                    {SKALA_MASUKAN.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              ))}
            </fieldset>
          ))}
          {CERITA_MASUKAN.map(([kunci, label]) => (
            <div className="field" key={kunci}><label htmlFor={`mk_cerita_${kunci}`}>{label}</label>
              <textarea id={`mk_cerita_${kunci}`} rows={3} value={isiCerita[kunci] || ""} onChange={(e) => setIsiCerita((p) => ({ ...p, [kunci]: e.target.value }))} /></div>
          ))}
          <div className="field"><label htmlFor="mk_rekomendasi">Secara keseluruhan, seberapa besar kemungkinan Ayah/Bunda merekomendasikan lembaga kami kepada keluarga lain?</label>
            <select id="mk_rekomendasi" required value={aspek[KUNCI_REKOMENDASI] || ""} onChange={(e) => setAspek((p) => ({ ...p, [KUNCI_REKOMENDASI]: e.target.value }))}>
              <option value="">— Pilih —</option>
              {SKALA_REKOMENDASI.map((k) => <option key={k} value={k}>{k}</option>)}
            </select></div>
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
              <span className="muted">{ASPEK_MASUKAN.map(([k, l]) => `${l}: ${(m.aspek as Record<string, string>)?.[k] || "—"}`).join(" · ")}{(m.aspek as Record<string, string>)?.[KUNCI_REKOMENDASI] ? ` · Rekomendasi: ${(m.aspek as Record<string, string>)[KUNCI_REKOMENDASI]}` : ""}</span>
              {m.status === "ditindaklanjuti" ? <><br /><span className="badge ok">Sudah ditindaklanjuti lembaga</span></> : null}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
