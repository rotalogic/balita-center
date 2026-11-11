"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Kartu Berkas Rujukan pada profil anak: berkas dibangkitkan dari profil anak
// begitu pemicu tercapai. Kolom tujuan selalu kosong pada draf.
type Ruj = { id: string; child_id: string | null; pemicu: string; tujuan: string | null; status: string };

export default function KartuRujukan({ childId, childName }: { childId: string; childName: string }) {
  const [rows, setRows] = useState<Ruj[]>([]);
  const [pemicu, setPemicu] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/rujukan")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRows((d.rujukan as Ruj[]).filter((x) => x.child_id === childId)); })
      .catch(() => undefined);
  }, [childId]);

  useEffect(load, [load]);

  async function buat() {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/rujukan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId, child_name: childName, pemicu }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Berkas rujukan dibuat sebagai draf — kolom tujuan masih kosong, terisi saat diterbitkan founder.");
    setPemicu("");
    load();
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Berkas Rujukan</h3>
      {rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>Belum ada berkas rujukan untuk anak ini.</p>
      ) : (
        <ul style={{ marginTop: 0 }}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/skrining/rujukan/${r.id}`}>{r.pemicu.slice(0, 70)}</Link>{" "}
              <span className="muted">— {r.status === "draft" ? "Draf (tujuan kosong)" : r.status === "siap_kirim" ? `Siap Kirim → ${r.tujuan}` : `Terkirim → ${r.tujuan}`}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="field">
        <label htmlFor={`pemicu_${childId}`}>Pemicu rujukan baru</label>
        <textarea id={`pemicu_${childId}`} rows={2} value={pemicu} onChange={(e) => setPemicu(e.target.value)}
          placeholder="mis. Ambang rujuk kelompok indikasi bahasa tercapai pada pemetaan guru" />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      <button className="btn secondary" type="button" disabled={busy || pemicu.trim().length < 5} style={{ marginTop: 8 }} onClick={() => void buat()}>
        Bangkitkan Berkas Rujukan (Draf)
      </button>
    </div>
  );
}
