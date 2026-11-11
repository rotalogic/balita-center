"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { ASPEK_MASUKAN, KUNCI_REKOMENDASI } from "@/lib/tahap4";

type M = Record<string, unknown> & { id: string };

export default function MasukanAdminPage() {
  const [rows, setRows] = useState<M[] | null>(null);
  const [tl, setTl] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/masukan").then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.masukan) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  async function tindak(id: string, status: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/masukan", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, tindak_lanjut: tl[id] || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Status masukan diperbarui.");
    load();
  }

  return (
    <>
      <PageHead title="Masukan Orang Tua" subtitle="Rekap masukan berkala dan tindak lanjutnya untuk admin & founder" />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {rows === null ? <LoadingState /> : rows.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Belum ada masukan masuk. Formulirnya hidup di Portal Orang Tua, menu Masukan.</p></div>
      ) : rows.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <strong>{String(m.child_name)}</strong>
            <span className="muted">Periode {String(m.periode)}</span>
            <span className={`badge ${m.status === "ditindaklanjuti" ? "ok" : m.status === "dibaca" ? "info" : "warn"}`}>
              {m.status === "ditindaklanjuti" ? "Ditindaklanjuti" : m.status === "dibaca" ? "Dibaca" : "Baru"}
            </span>
          </div>
          <p style={{ margin: "8px 0 0" }}>
            {ASPEK_MASUKAN.map(([k, l]) => `${l}: ${(m.aspek as Record<string, string>)?.[k] || "—"}`).join(" · ")}{(m.aspek as Record<string, string>)?.[KUNCI_REKOMENDASI] ? ` · Kemungkinan merekomendasikan: ${(m.aspek as Record<string, string>)[KUNCI_REKOMENDASI]}` : ""}
          </p>
          {m.cerita ? <p className="muted" style={{ marginTop: 4 }}>“{String(m.cerita)}”</p> : null}
          {m.tindak_lanjut ? <p style={{ marginTop: 4 }}><strong>Tindak lanjut:</strong> {String(m.tindak_lanjut)}</p> : null}
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input aria-label="Catatan tindak lanjut" placeholder="Catatan tindak lanjut…" value={tl[m.id] || ""}
              onChange={(e) => setTl((p) => ({ ...p, [m.id]: e.target.value }))} style={{ flex: "1 1 260px" }} />
            <button className="btn small secondary" type="button" disabled={busy} onClick={() => void tindak(m.id, "dibaca")}>Tandai Dibaca</button>
            <button className="btn small" type="button" disabled={busy} onClick={() => void tindak(m.id, "ditindaklanjuti")}>Simpan Tindak Lanjut</button>
          </div>
        </div>
      ))}
    </>
  );
}
