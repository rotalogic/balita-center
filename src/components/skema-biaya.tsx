"use client";

import { useCallback, useEffect, useState } from "react";

type Komponen = { pos: string; jumlah: number };
type Skema = {
  id: string; nama: string; status: string; komponen: Komponen[]; keterangan: string | null;
};
type Program = { id: string; name: string; skema_id: string | null };

const rupiah = (v: number) => `Rp ${Number(v || 0).toLocaleString("id-ID")}`;

// Kartu Skema Biaya pada halaman Keuangan: skema lembaga berstatus Final
// atau Rancangan. Skema Rancangan terkunci di server dari pembuatan invoice
// dan penerimaan pembayaran; hanya founder yang menjadikannya Final.
export default function SkemaBiaya() {
  const [skema, setSkema] = useState<Skema[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [nama, setNama] = useState("");
  const [komponen, setKomponen] = useState<Komponen[]>([{ pos: "", jumlah: 0 }]);
  const [taut, setTaut] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/skema")
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setSkema(d.skema); setPrograms(d.programs); } })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function buat() {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/skema", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, komponen: komponen.filter((k) => k.pos.trim()) }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`Skema "${nama}" dibuat berstatus Rancangan — belum dapat dipakai untuk tagihan sampai founder menjadikannya Final.`);
    setNama("");
    setKomponen([{ pos: "", jumlah: 0 }]);
    load();
  }

  async function aksi(id: string, body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/skema/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(pesan);
    load();
  }

  return (
    <article className="card">
      <h2 style={{ marginTop: 0 }}>Skema Biaya Lembaga</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Setiap skema membawa status <strong>Final</strong> atau <strong>Rancangan</strong>. Skema Rancangan terkunci di
        lapisan server: invoice tidak dapat dibuat dan pembayaran tidak dapat diterima dari program yang skemanya
        masih Rancangan, dan skema itu tidak tampil sebagai harga resmi. Hanya founder yang mengubahnya menjadi Final.
      </p>
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}

      {skema.map((s) => {
        const total = (s.komponen || []).reduce((a, k) => a + Number(k.jumlah || 0), 0);
        const tertaut = programs.filter((p) => p.skema_id === s.id);
        return (
          <div key={s.id} style={{ borderTop: "1px solid var(--line, #e5ddd2)", padding: "10px 0" }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong>{s.nama}</strong>
              <span className={`badge ${s.status === "final" ? "ok" : "warn"}`}>{s.status === "final" ? "Final" : "Rancangan — Terkunci"}</span>
              <span className="muted">{(s.komponen || []).map((k) => `${k.pos} ${rupiah(k.jumlah)}`).join(" · ")}{s.komponen?.length ? ` — total ${rupiah(total)}` : ""}</span>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
              <span className="muted">Program tertaut: {tertaut.length ? tertaut.map((p) => p.name).join(", ") : "belum ada"}</span>
              <select aria-label={`Program untuk ${s.nama}`} value={taut[s.id] || ""} onChange={(e) => setTaut((t) => ({ ...t, [s.id]: e.target.value }))}>
                <option value="">Pilih program…</option>
                {programs.filter((p) => !p.skema_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn small secondary" type="button" disabled={busy || !taut[s.id]}
                onClick={() => void aksi(s.id, { aksi: "tautkan_program", program_id: taut[s.id] }, "Program tertaut ke skema.")}>
                Tautkan Program
              </button>
              {tertaut.map((p) => (
                <button key={p.id} className="btn small danger" type="button" disabled={busy}
                  onClick={() => void aksi(s.id, { aksi: "lepas_program", program_id: p.id }, "Tautan program dilepas.")}>
                  Lepas {p.name}
                </button>
              ))}
              {s.status === "rancangan" ? (
                <button className="btn small" type="button" disabled={busy}
                  onClick={() => void aksi(s.id, { aksi: "jadikan_final" }, `Skema "${s.nama}" kini FINAL — kunci server terangkat.`)}>
                  Jadikan Final (Founder)
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <h3 style={{ marginBottom: 4 }}>Buat Skema Baru (lahir sebagai Rancangan)</h3>
      <div className="grid-form">
        <div className="field"><label htmlFor="sk_nama">Nama skema</label>
          <input id="sk_nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Skema Reguler ZKC" /></div>
      </div>
      {komponen.map((k, i) => (
        <div className="grid-form" key={i} style={{ marginTop: 6 }}>
          <div className="field"><label htmlFor={`sk_pos_${i}`}>Pos biaya</label>
            <input id={`sk_pos_${i}`} value={k.pos} placeholder="mis. Uang pendaftaran"
              onChange={(e) => setKomponen((p) => p.map((x, j) => (j === i ? { ...x, pos: e.target.value } : x)))} /></div>
          <div className="field"><label htmlFor={`sk_jml_${i}`}>Jumlah (Rp)</label>
            <input id={`sk_jml_${i}`} type="number" min={0} value={k.jumlah}
              onChange={(e) => setKomponen((p) => p.map((x, j) => (j === i ? { ...x, jumlah: Number(e.target.value) } : x)))} /></div>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn secondary" type="button" onClick={() => setKomponen((p) => [...p, { pos: "", jumlah: 0 }])}>+ Pos Biaya</button>
        <button className="btn" type="button" disabled={busy || nama.trim().length < 3} onClick={() => void buat()}>Simpan Skema (Rancangan)</button>
      </div>
    </article>
  );
}
