"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { tahapProbation } from "@/lib/tahap4";

type Staf = { id: string; full_name: string; position: string };
type Prob = Record<string, unknown> & { id: string; staff_id: string; mulai: string; persetujuan: Record<string, string> };

export default function ProbationPage() {
  const [staf, setStaf] = useState<Staf[]>([]);
  const [rows, setRows] = useState<Prob[] | null>(null);
  const [staffId, setStaffId] = useState("");
  const [mulai, setMulai] = useState("");
  const [rencana, setRencana] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/sdm/probation").then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.probation) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/meta").then((r) => r.json())
      .then((d) => { if (d.ok) setStaf(d.staff || []); }).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/sdm/probation", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(pesan);
    load();
  }

  async function mulaiBaru(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/sdm/probation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, mulai }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Masa probation dimulai — tiga bulan sejak hari pertama bekerja.");
    load();
  }

  return (
    <>
      <PageHead title="Ketentuan Masa Magang & Probation Guru" subtitle="Tiga bulan: Adaptasi & Pelatihan → Praktik Terbimbing → Penilaian Standar"
        action={<Link className="btn secondary" href="/sdm">&larr; SDM</Link>} />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Standar kelulusan: seluruh kompetensi inti pada sepuluh gugus mencapai minimal <strong>Tingkat 3 Kompeten</strong> pada
          akhir bulan ketiga. Pelanggaran berat terkait keselamatan anak, kerahasiaan data, atau kekerasan dalam bentuk
          apa pun <strong>menggugurkan masa probation seketika</strong>. Selama probation lembaga memberi dukungan: pelatihan
          internal, templat dan contoh resmi, serta sesi pembinaan yang tercatat. Seluruh Aturan Guru berlaku penuh sejak hari pertama.
        </p>
        <form onSubmit={mulaiBaru}>
          <div className="grid-form">
            <div className="field"><label htmlFor="pb_staf">Guru baru *</label>
              <select id="pb_staf" required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Pilih guru…</option>
                {staf.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.position}</option>)}
              </select></div>
            <div className="field"><label htmlFor="pb_mulai">Hari pertama bekerja *</label>
              <input id="pb_mulai" type="date" required value={mulai} onChange={(e) => setMulai(e.target.value)} /></div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Menyimpan…" : "Mulai Probation"}</button>
        </form>
      </div>

      {rows === null ? <LoadingState /> : rows.map((p) => {
        const tahap = tahapProbation(p.mulai);
        const selesai = p.status === "selesai";
        return (
          <div className="card" key={p.id} style={{ marginTop: 12 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <strong>{String(p.staff_name)}</strong>
              <span className="muted">mulai {tanggalPanjang(p.mulai)}</span>
              {p.pelanggaran_berat ? <span className="badge warn">Gugur — pelanggaran berat</span>
                : selesai ? <span className="badge ok">Selesai · {String(p.hasil)}</span>
                : <span className="badge info">Bulan ke-{tahap.bulanKe} · {tahap.nama}</span>}
              {p.hasil === "diperpanjang" && !selesai ? <span className="badge warn">Diperpanjang {String(p.perpanjangan_bulan)} bulan</span> : null}
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Persetujuan ketentuan: Guru {p.persetujuan?.guru ? "✓" : "○"} · Manager {p.persetujuan?.manager ? "✓" : "○"} · Founder {p.persetujuan?.founder ? "✓" : "○"}
              {" — "}persetujuan guru, manager, dan founder tercatat beserta waktunya.
            </p>
            {p.rencana_perbaikan ? <p style={{ marginTop: 4 }}><strong>Rencana Perbaikan:</strong> {String(p.rencana_perbaikan)}</p> : null}
            {p.pelanggaran_keterangan ? <p style={{ marginTop: 4 }}><strong>Pelanggaran:</strong> {String(p.pelanggaran_keterangan)}</p> : null}
            {!selesai ? (
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn small secondary" type="button" disabled={busy} onClick={() => void patch({ id: p.id, aksi: "setujui", peran: "guru" }, "Persetujuan guru tercatat.")}>Setujui (Guru)</button>
                <button className="btn small secondary" type="button" disabled={busy} onClick={() => void patch({ id: p.id, aksi: "setujui", peran: "manager" }, "Persetujuan manager tercatat.")}>Setujui (Manager)</button>
                <button className="btn small secondary" type="button" disabled={busy} onClick={() => void patch({ id: p.id, aksi: "setujui", peran: "founder" }, "Persetujuan founder tercatat.")}>Setujui (Founder)</button>
                <button className="btn small" type="button" disabled={busy} onClick={() => void patch({ id: p.id, aksi: "putuskan", hasil: "diangkat" }, "Guru dinyatakan memenuhi standar dan diangkat.")}>Putuskan: Diangkat</button>
                <input aria-label="Rencana perbaikan tertulis" placeholder="Rencana Perbaikan tertulis (untuk perpanjangan)…" value={rencana[p.id] || ""}
                  onChange={(e) => setRencana((r) => ({ ...r, [p.id]: e.target.value }))} style={{ flex: "1 1 240px" }} />
                <button className="btn small secondary" type="button" disabled={busy}
                  onClick={() => void patch({ id: p.id, aksi: "putuskan", hasil: "diperpanjang", rencana_perbaikan: rencana[p.id] || "", perpanjangan_bulan: 1 }, "Probation diperpanjang satu bulan dengan Rencana Perbaikan.")}>
                  Perpanjang 1 Bulan
                </button>
                <button className="btn small danger" type="button" disabled={busy} onClick={() => void patch({ id: p.id, aksi: "putuskan", hasil: "tidak_lanjut" }, "Guru tidak dilanjutkan.")}>Tidak Dilanjutkan</button>
                <button className="btn small danger" type="button" disabled={busy}
                  onClick={() => void patch({ id: p.id, aksi: "pelanggaran", keterangan: rencana[p.id] || "" }, "Pelanggaran berat tercatat — probation gugur seketika.")}>
                  Catat Pelanggaran Berat (isi keterangan di kolom rencana)
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
