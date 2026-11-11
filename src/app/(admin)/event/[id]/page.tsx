"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import LencanaAlergi from "@/components/lencana-alergi";
import { tanggalPanjang } from "@/lib/format";
import { LABEL_JENIS_EVENT, STATUS_EDISI, merekEvent } from "@/lib/event";

type Edisi = Record<string, string | number | null>;
type Rab = { id?: string; pos: string; rencana: string | number; realisasi: string | number };
type Peserta = Record<string, string | number | boolean | null> & { id: string };
type Ringkasan = Record<string, number>;

const rupiah = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `Rp ${Number(v).toLocaleString("id-ID")}`;

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [edisi, setEdisi] = useState<Edisi | null>(null);
  const [rab, setRab] = useState<Rab[]>([]);
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [keuangan, setKeuangan] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/event/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Edisi tidak bisa dimuat."); return; }
        const e = d.edisi as Edisi;
        setEdisi(e);
        setRab((d.rab as Rab[]).map((r) => ({ pos: r.pos, rencana: r.rencana, realisasi: r.realisasi })));
        setPeserta(d.peserta as Peserta[]);
        setRingkasan(d.ringkasan as Ringkasan | null);
        setKeuangan(Boolean(d.keuangan));
        setF({
          nama: String(e.nama || ""), tema: String(e.tema || ""),
          tanggal: String(e.tanggal || "").slice(0, 10), kuota: String(e.kuota ?? ""),
          htm_reguler: String(e.htm_reguler ?? ""), htm_early_bird: String(e.htm_early_bird ?? ""),
          persen_bagi_hasil: String(e.persen_bagi_hasil ?? 0), status: String(e.status || "rancangan"),
          proposal_url: String(e.proposal_url || ""), rundown: String(e.rundown || ""),
          surat_ref: String(e.surat_ref || ""), catatan: String(e.catatan || ""),
        });
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/event/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error || "Gagal menyimpan."); return; }
    setInfo(pesan);
    load();
  }

  if (error && !edisi) {
    return (<><PageHead title="Detail Edisi" /><ErrorState message={error} />
      <p style={{ marginTop: 12 }}><Link className="btn secondary" href="/event">&larr; Kembali</Link></p></>);
  }
  if (!edisi) return (<><PageHead title="Detail Edisi" /><LoadingState /></>);

  return (
    <>
      <PageHead
        title={String(edisi.nama)}
        subtitle={`${LABEL_JENIS_EVENT[String(edisi.jenis)] || ""} · ${merekEvent(String(edisi.jenis))} · ${String(edisi.branch_name || "")}`}
        action={<Link className="btn secondary" href="/event">&larr; Semua Edisi</Link>}
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Data &amp; Dokumen Edisi</h2>
        <div className="grid-form">
          <div className="field"><label htmlFor="d_nama">Nama Edisi</label>
            <input id="d_nama" value={f.nama} onChange={(e) => set("nama", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_tema">Tema</label>
            <input id="d_tema" value={f.tema} onChange={(e) => set("tema", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_tanggal">Tanggal</label>
            <input id="d_tanggal" type="date" value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_kuota">Kuota</label>
            <input id="d_kuota" type="number" min={0} value={f.kuota} onChange={(e) => set("kuota", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_htm">HTM Reguler (Rp)</label>
            <input id="d_htm" type="number" min={0} value={f.htm_reguler} onChange={(e) => set("htm_reguler", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_eb">HTM Early Bird (Rp)</label>
            <input id="d_eb" type="number" min={0} value={f.htm_early_bird} onChange={(e) => set("htm_early_bird", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_bh">Bagi Hasil Mitra (%)</label>
            <input id="d_bh" type="number" min={0} max={100} value={f.persen_bagi_hasil} onChange={(e) => set("persen_bagi_hasil", e.target.value)} /></div>
          <div className="field"><label htmlFor="d_status">Status Edisi</label>
            <select id="d_status" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(STATUS_EDISI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="field"><label htmlFor="d_proposal">Tautan Proposal Edisi</label>
            <input id="d_proposal" value={f.proposal_url} onChange={(e) => set("proposal_url", e.target.value)} placeholder="https://…" /></div>
          <div className="field"><label htmlFor="d_surat">Surat Kerja Sama (nomor/tautan modul Surat)</label>
            <input id="d_surat" value={f.surat_ref} onChange={(e) => set("surat_ref", e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="d_rundown">Rundown Edisi</label>
          <textarea id="d_rundown" rows={7} value={f.rundown} onChange={(e) => set("rundown", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="d_catatan">Catatan</label>
          <textarea id="d_catatan" rows={2} value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
        </div>
        <button className="btn" type="button" disabled={busy} style={{ marginTop: 10 }}
          onClick={() => void patch({ ...f }, "Data edisi tersimpan.")}>
          {busy ? "Menyimpan…" : "Simpan Edisi"}
        </button>
      </div>

      {keuangan ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>RAB Edisi &amp; Ringkasan Otomatis</h2>
          <table>
            <thead><tr><th>Pos Anggaran</th><th>Rencana (Rp)</th><th>Realisasi (Rp)</th><th /></tr></thead>
            <tbody>
              {rab.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.pos} onChange={(e) => setRab((p) => p.map((x, j) => (j === i ? { ...x, pos: e.target.value } : x)))} placeholder="mis. Konsumsi peserta" /></td>
                  <td><input type="number" min={0} value={r.rencana} onChange={(e) => setRab((p) => p.map((x, j) => (j === i ? { ...x, rencana: e.target.value } : x)))} /></td>
                  <td><input type="number" min={0} value={r.realisasi} onChange={(e) => setRab((p) => p.map((x, j) => (j === i ? { ...x, realisasi: e.target.value } : x)))} /></td>
                  <td><button className="btn small danger" type="button" onClick={() => setRab((p) => p.filter((_, j) => j !== i))}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn secondary" type="button" onClick={() => setRab((p) => [...p, { pos: "", rencana: 0, realisasi: 0 }])}>+ Pos Anggaran</button>
            <button className="btn" type="button" disabled={busy} onClick={() => void patch({ aksi: "rab_simpan", rab }, "RAB tersimpan — ringkasan diperbarui.")}>
              {busy ? "Menyimpan…" : "Simpan RAB"}
            </button>
          </div>
          {ringkasan ? (
            <dl style={{ marginTop: 16 }}>
              <dt className="muted">Peserta</dt><dd>{ringkasan.peserta_terdaftar} terdaftar · {ringkasan.peserta_lunas} lunas</dd>
              <dt className="muted">Pemasukan HTM Reguler</dt><dd>{rupiah(ringkasan.pemasukan_reguler)}</dd>
              <dt className="muted">Pemasukan HTM Early Bird</dt><dd>{rupiah(ringkasan.pemasukan_early_bird)}</dd>
              <dt className="muted">Total Pemasukan</dt><dd><strong>{rupiah(ringkasan.total_pemasukan)}</strong></dd>
              <dt className="muted">Bagi Hasil Mitra ({String(edisi.persen_bagi_hasil)}%)</dt><dd>{rupiah(ringkasan.bagi_hasil)}</dd>
              <dt className="muted">Total Biaya Realisasi</dt><dd>{rupiah(ringkasan.total_realisasi)}</dd>
              <dt className="muted">Sisa Bersih Edisi</dt><dd><strong>{rupiah(ringkasan.sisa_bersih)}</strong></dd>
            </dl>
          ) : null}
          <p className="muted" style={{ fontSize: 13 }}>
            Angka anggaran hanya terlihat oleh founder dan manager, dan dihitung otomatis dari peserta
            yang tercatat lunas serta realisasi RAB.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Anggaran Edisi</h2>
          <p className="muted">RAB dan ringkasan keuangan edisi hanya terlihat oleh founder dan manager.</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Peserta Edisi ({peserta.length})</h2>
        {peserta.length === 0 ? (
          <p className="muted">Belum ada peserta. Pendaftaran masuk lewat Formulir Insidentil dengan edisi ini dipilih.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Anak</th><th>Orang Tua · WA</th><th>Tarif</th><th>Pembayaran</th><th>Ketentuan</th><th>Dokumentasi</th><th>Laporan Ringan</th><th /></tr>
            </thead>
            <tbody>
              {peserta.map((p) => (
                <tr key={p.id}>
                  <td>
                    {String(p.child_name)}
                    <LencanaAlergi tidakAda={Boolean(p.alergi_tidak_ada)} jenis={p.alergi_jenis as string | null} />
                  </td>
                  <td>{String(p.parent_name)}<div className="muted">{String(p.wa_number)}</div></td>
                  <td>{p.tarif_jenis === "early_bird" ? "Early Bird" : "Reguler"}<div className="muted">{rupiah(p.biaya as string)}</div></td>
                  <td>
                    {keuangan ? (
                      <button className={`btn small ${p.bayar_status === "lunas" ? "secondary" : ""}`} type="button" disabled={busy}
                        onClick={() => void patch({ aksi: "peserta_bayar", insidentil_id: p.id, bayar_status: p.bayar_status === "lunas" ? "belum" : "lunas" }, "Status pembayaran diperbarui.")}>
                        {p.bayar_status === "lunas" ? "✓ Lunas" : "Tandai Lunas"}
                      </button>
                    ) : (
                      <span className={`badge ${p.bayar_status === "lunas" ? "ok" : "warn"}`}>{p.bayar_status === "lunas" ? "Lunas" : "Belum"}</span>
                    )}
                  </td>
                  <td>{p.setuju_ketentuan_bayar ? "✓ Disetujui" : "—"}</td>
                  <td>{p.paket_terkirim ? "✓ Terkirim" : "Belum"}</td>
                  <td>{p.laporan_terkirim ? "✓ Terkirim" : p.punya_laporan ? "Tersusun" : "—"}</td>
                  <td><Link className="btn small secondary" href={`/admission/insidentil/${p.id}`}>Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {edisi.tanggal ? <p className="muted" style={{ fontSize: 13 }}>Edisi berjalan {tanggalPanjang(String(edisi.tanggal))}. Sesudah edisi, setiap anak menerima Laporan Ringan Pop Up dari halaman detail pendaftarannya.</p> : null}
      </div>
    </>
  );
}
