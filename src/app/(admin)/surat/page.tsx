"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";

type Surat = Record<string, string | null> & { id: string };
type Template = { id: string; nama: string; kode_jenis: string; isi: string; perihal_default: string | null };

export default function SuratPage() {
  const [surat, setSurat] = useState<Surat[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplId, setTplId] = useState("");
  const [variabel, setVariabel] = useState<Record<string, string>>({});
  const [tujuan, setTujuan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/surat").then((r) => r.json())
      .then((d) => { if (d.ok) { setSurat(d.surat); setTemplates(d.templates); } else setError(d.error); })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);
  const tpl = templates.find((t) => t.id === tplId);
  const kunci = tpl ? [...new Set((tpl.isi.match(/\{\{[^}]+\}\}/g) || []).map((m) => m.slice(2, -2)))] : [];

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/surat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: tplId, variabel, tujuan: tujuan || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Surat dibuat sebagai draf tanpa nomor. Nomor otomatis diberikan saat surat diterbitkan." +
      (d.variabel_belum_terisi?.length ? ` Variabel belum terisi: ${d.variabel_belum_terisi.join(", ")}.` : ""));
    setVariabel({});
    setTujuan("");
    load();
  }

  return (
    <>
      <PageHead title="Surat & Proposal" subtitle="Pustaka template, penomoran otomatis, dan arsip surat berstatus" />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Buat Surat dari Template</h2>
        <form onSubmit={buat}>
          <div className="grid-form">
            <div className="field"><label htmlFor="sr_tpl">Template *</label>
              <select id="sr_tpl" required value={tplId} onChange={(e) => { setTplId(e.target.value); setVariabel({}); }}>
                <option value="">Pilih template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nama} ({t.kode_jenis})</option>)}
              </select></div>
            <div className="field"><label htmlFor="sr_tujuan">Kepada / Tujuan surat</label>
              <input id="sr_tujuan" value={tujuan} onChange={(e) => setTujuan(e.target.value)} /></div>
          </div>
          {kunci.map((k) => (
            <div className="field" key={k}>
              <label htmlFor={`sr_v_${k}`}>{`{{${k}}}`}</label>
              <input id={`sr_v_${k}`} value={variabel[k] || ""} onChange={(e) => setVariabel((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <button className="btn" type="submit" disabled={busy || !tplId} style={{ marginTop: 10 }}>
            {busy ? "Menyimpan…" : "Buat Draf Surat"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Arsip Surat</h2>
        {surat === null ? <LoadingState /> : surat.length === 0 ? (
          <p className="muted">Belum ada surat. Nomor surat berformat urut/kode jenis/bulan Romawi/tahun dan hanya lahir saat penerbitan.</p>
        ) : (
          <table>
            <thead><tr><th>Nomor</th><th>Perihal</th><th>Tujuan</th><th>Status</th><th>Dibuat</th><th /></tr></thead>
            <tbody>
              {surat.map((s) => (
                <tr key={s.id}>
                  <td>{s.nomor || <span className="muted">(draf — belum bernomor)</span>}</td>
                  <td>{s.perihal}</td>
                  <td>{s.tujuan || "—"}</td>
                  <td><span className={`badge ${s.status === "terbit" ? "ok" : s.status === "arsip" ? "info" : "warn"}`}>{s.status === "terbit" ? "Terbit" : s.status === "arsip" ? "Arsip" : "Draf"}</span></td>
                  <td>{s.created_at ? tanggalPanjang(s.created_at) : ""}</td>
                  <td><Link className="btn small secondary" href={`/surat/${s.id}`}>Kelola</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
