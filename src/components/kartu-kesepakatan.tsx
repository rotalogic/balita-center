"use client";

import { useCallback, useEffect, useState } from "react";
import KesepakatanAwal from "@/components/kesepakatan-awal";
import { tanggalPanjang } from "@/lib/format";

type Status = {
  disetujui: boolean; nama_penyetuju: string | null; disetujui_at: string | null; sumber: string | null;
};

// Kartu Kesepakatan Awal Keluarga pada profil anak: status persetujuan dari
// Formulir Trial atau catatan registrasi, plus pencatatan persetujuan baru.
export default function KartuKesepakatan({ childId }: { childId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [nama, setNama] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/children/${childId}/kesepakatan`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStatus(d.kesepakatan); })
      .catch(() => undefined);
  }, [childId]);

  useEffect(load, [load]);

  async function catat() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/children/${childId}/kesepakatan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama_penyetuju: nama }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Persetujuan Kesepakatan Awal Keluarga tercatat.");
    setNama("");
    load();
  }

  return (
    <article className="card">
      <h2>Kesepakatan Awal Keluarga</h2>
      {status?.disetujui ? (
        <p>
          <span className="badge ok">Sudah disetujui</span>{" "}
          {status.nama_penyetuju ? <>oleh {status.nama_penyetuju} </> : null}
          {status.disetujui_at ? <>· {tanggalPanjang(status.disetujui_at)} </> : null}
          {status.sumber ? <span className="muted">(lewat {status.sumber === "trial" ? "Formulir Trial" : "registrasi"})</span> : null}
        </p>
      ) : (
        <>
          <p><span className="badge warn">Belum tercatat</span></p>
          <div className="field">
            <label htmlFor="kk_nama">Nama orang tua yang menyetujui</label>
            <input id="kk_nama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <button className="btn small" type="button" disabled={busy || nama.trim().length < 2} style={{ marginTop: 8 }} onClick={() => void catat()}>
            {busy ? "Mencatat…" : "Catat Persetujuan"}
          </button>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </>
      )}
      {info ? <p className="success" role="status">{info}</p> : null}
      <div style={{ marginTop: 10 }}>
        <KesepakatanAwal />
      </div>
    </article>
  );
}
