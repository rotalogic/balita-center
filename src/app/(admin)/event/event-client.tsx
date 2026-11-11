"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { JENIS_EVENT, LABEL_JENIS_EVENT, STATUS_EDISI, merekEvent } from "@/lib/event";

type Edisi = Record<string, string | number | null> & { id: string };

const rupiah = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `Rp ${Number(v).toLocaleString("id-ID")}`;

export function EventClient({ bagian }: { bagian?: string }) {
  const [edisi, setEdisi] = useState<Edisi[] | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    jenis: "pop_up", nama: "", tema: "", tanggal: "", kuota: "",
    htm_reguler: "", htm_early_bird: "", persen_bagi_hasil: "20", branch_id: "",
  });

  const load = useCallback(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Daftar edisi tidak bisa dimuat."); return; }
        setEdisi(d.edisi as Edisi[]);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setBranches(d.branches || []); })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/event", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, branch_id: f.branch_id || branches[0]?.id }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error || "Edisi gagal dibuat."); return; }
    setInfo("Edisi event dibuat sebagai rancangan.");
    setF({ jenis: "pop_up", nama: "", tema: "", tanggal: "", kuota: "", htm_reguler: "", htm_early_bird: "", persen_bagi_hasil: "20", branch_id: "" });
    load();
  }

  return (
    <>
      <PageHead
        title="Program Event"
        subtitle="Area ketiga lembaga: seluruh edisi event dalam satu daftar — Pop Up Class Grand Mercure, THE BAREFOOT, Holiday Camp, seminar, event alam, dan acara edukasi."
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <nav aria-label="Kamar-kamar Program Event" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "buat" ? "btn" : "btn secondary"} href="/event/buat">Buat Edisi</a>
        <a className={bagian === "daftar" ? "btn" : "btn secondary"} href="/event/daftar">Daftar Edisi</a>
      </nav>

      {(!bagian || bagian === "buat") && (<>
      <form onSubmit={buat} className="card">
        <h2 style={{ marginTop: 0 }}>Buat Edisi Baru</h2>
        <div className="grid-form">
          <div className="field">
            <label htmlFor="ev_jenis">Jenis Event</label>
            <select id="ev_jenis" value={f.jenis} onChange={(e) => set("jenis", e.target.value)}>
              {JENIS_EVENT.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ev_nama">Nama Edisi</label>
            <input id="ev_nama" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="mis. Pop Up Class — Tema Alam" />
          </div>
          <div className="field">
            <label htmlFor="ev_tema">Tema</label>
            <input id="ev_tema" value={f.tema} onChange={(e) => set("tema", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev_tanggal">Tanggal</label>
            <input id="ev_tanggal" type="date" value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev_kuota">Kuota Peserta</label>
            <input id="ev_kuota" type="number" min={0} value={f.kuota} onChange={(e) => set("kuota", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev_htm">HTM Reguler (Rp)</label>
            <input id="ev_htm" type="number" min={0} value={f.htm_reguler} onChange={(e) => set("htm_reguler", e.target.value)} placeholder="125000" />
          </div>
          <div className="field">
            <label htmlFor="ev_eb">HTM Early Bird (Rp)</label>
            <input id="ev_eb" type="number" min={0} value={f.htm_early_bird} onChange={(e) => set("htm_early_bird", e.target.value)} placeholder="100000" />
          </div>
          <div className="field">
            <label htmlFor="ev_bh">Bagi Hasil Mitra (%)</label>
            <input id="ev_bh" type="number" min={0} max={100} value={f.persen_bagi_hasil} onChange={(e) => set("persen_bagi_hasil", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev_cabang">Cabang</label>
            <select id="ev_cabang" value={f.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Edisi lahir sebagai rancangan. Pendaftaran hanya bisa dibuka sesudah HTM ditetapkan —
          selama HTM kosong, edisi berstatus Tutup (kaidah Holiday Camp Ziel Kids Club).
        </p>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Buat Edisi"}</button>
      </form>

      </>)}

      {(!bagian || bagian === "daftar") && (<>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Daftar Edisi</h2>
        {!edisi ? <LoadingState /> : edisi.length === 0 ? (
          <EmptyState title="Belum ada edisi" body="Buat edisi pertama lewat formulir di atas." />
        ) : (
          <table>
            <thead>
              <tr><th>Edisi</th><th>Jenis · Merek</th><th>Tanggal</th><th>HTM</th><th>Peserta</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {edisi.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/event/${e.id}`}>{String(e.nama)}</Link>
                    {e.tema ? <div className="muted">{String(e.tema)}</div> : null}
                  </td>
                  <td>{LABEL_JENIS_EVENT[String(e.jenis)] || String(e.jenis)}<div className="muted">{merekEvent(String(e.jenis))}</div></td>
                  <td>{e.tanggal ? tanggalPanjang(String(e.tanggal)) : "—"}</td>
                  <td>{rupiah(e.htm_reguler)}{e.htm_early_bird ? <div className="muted">EB {rupiah(e.htm_early_bird)}</div> : null}</td>
                  <td>{Number(e.peserta || 0)}{e.kuota ? ` / ${e.kuota}` : ""}</td>
                  <td><span className={`badge ${e.status === "buka" ? "ok" : e.status === "selesai" ? "info" : "neutral"}`}>{STATUS_EDISI[String(e.status)] || String(e.status)}</span></td>
                  <td><Link className="btn small secondary" href={`/event/${e.id}`}>Kelola</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>)}
    </>
  );
}
