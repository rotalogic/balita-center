"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { PERTANYAAN_PERTAMA } from "@/lib/tahap4";

type Lowongan = Record<string, unknown> & { id: string; syarat_mutlak: string[]; pertanyaan: string[] };
type Lamaran = Record<string, unknown> & { id: string };

const ALUR: Array<[string, string]> = [
  ["masuk", "Lamaran Masuk"], ["tersaring", "Tersaring"], ["wawancara", "Wawancara"],
  ["observasi", "Observasi Mengajar"], ["diterima", "Keputusan: Diterima"], ["ditolak", "Keputusan: Ditolak"],
  ["onboarding", "Onboarding"], ["tidak_memenuhi", "Tidak Memenuhi Syarat Mutlak"],
];

export default function RekrutmenPage() {
  const [lowongan, setLowongan] = useState<Lowongan[]>([]);
  const [lamaran, setLamaran] = useState<Lamaran[] | null>(null);
  const [judul, setJudul] = useState("");
  const [program, setProgram] = useState("");
  const [syarat, setSyarat] = useState("");
  const [pilihLow, setPilihLow] = useState("");
  const [pelamar, setPelamar] = useState({ nama: "", email: "", wa_number: "", cv_nama: "" });
  const [cekSyarat, setCekSyarat] = useState<Record<string, boolean>>({});
  const [jawaban1, setJawaban1] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/rekrutmen").then((r) => r.json())
      .then((d) => { if (d.ok) { setLowongan(d.lowongan); setLamaran(d.lamaran); } else setError(d.error); })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);
  const low = lowongan.find((l) => l.id === pilihLow);

  async function buatLowongan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/rekrutmen", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        judul, program_label: program,
        syarat_mutlak: syarat.split("\n").map((s) => s.trim()).filter(Boolean),
        pertanyaan: [],
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Lowongan dibuat. Pertanyaan penyaring pertama terkunci pada bunyi resmi lembaga.");
    setJudul(""); setProgram(""); setSyarat("");
    load();
  }

  async function kirimLamaran(e: React.FormEvent) {
    e.preventDefault();
    if (!low) return;
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/rekrutmen/lamaran", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowongan_id: low.id, ...pelamar, syarat: cekSyarat, jawaban: [jawaban1] }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(d.status === "tidak_memenuhi"
      ? `Lamaran ${pelamar.nama} tercatat TIDAK MEMENUHI syarat mutlak: ${(d.tidak_terpenuhi || []).join(", ")} — penyaringan otomatis menutup alurnya.`
      : `Lamaran ${pelamar.nama} masuk ke alur seleksi.`);
    setPelamar({ nama: "", email: "", wa_number: "", cv_nama: "" });
    setCekSyarat({});
    setJawaban1("");
    load();
  }

  async function maju(id: string, status: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/rekrutmen/lamaran", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo("Status lamaran diperbarui.");
    load();
  }

  return (
    <>
      <PageHead title="Rekrutmen Guru" subtitle="Lowongan per program, penyaringan otomatis syarat mutlak, dan alur seleksi sampai onboarding"
        action={<Link className="btn secondary" href="/sdm">&larr; SDM</Link>} />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Buat Lowongan</h2>
        <form onSubmit={buatLowongan}>
          <div className="grid-form">
            <div className="field"><label htmlFor="rk_judul">Judul lowongan *</label>
              <input id="rk_judul" required value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. Guru Kelas ZKC" /></div>
            <div className="field"><label htmlFor="rk_program">Program</label>
              <input id="rk_program" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Ziel Kids Club / Sekolah Alam Montessori" /></div>
          </div>
          <div className="field"><label htmlFor="rk_syarat">Syarat mutlak (satu per baris — penyaringan otomatis menolak yang tidak terpenuhi)</label>
            <textarea id="rk_syarat" rows={3} value={syarat} onChange={(e) => setSyarat(e.target.value)} placeholder={"Bersedia bekerja penuh waktu\nBer domisili Malang Raya"} /></div>
          <p className="muted">Empat pertanyaan penyaring diawali pertanyaan terkunci: “{PERTANYAAN_PERTAMA}”</p>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Buka Lowongan"}</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Catat Lamaran Masuk</h2>
        <div className="field"><label htmlFor="rk_pilih">Lowongan</label>
          <select id="rk_pilih" value={pilihLow} onChange={(e) => setPilihLow(e.target.value)}>
            <option value="">Pilih lowongan…</option>
            {lowongan.filter((l) => l.status === "buka").map((l) => <option key={l.id} value={l.id}>{String(l.judul)}</option>)}
          </select></div>
        {low ? (
          <form onSubmit={kirimLamaran}>
            <div className="grid-form">
              <div className="field"><label htmlFor="lm_nama">Nama pelamar *</label>
                <input id="lm_nama" required value={pelamar.nama} onChange={(e) => setPelamar({ ...pelamar, nama: e.target.value })} /></div>
              <div className="field"><label htmlFor="lm_email">Email</label>
                <input id="lm_email" type="email" value={pelamar.email} onChange={(e) => setPelamar({ ...pelamar, email: e.target.value })} /></div>
              <div className="field"><label htmlFor="lm_wa">WhatsApp</label>
                <input id="lm_wa" value={pelamar.wa_number} onChange={(e) => setPelamar({ ...pelamar, wa_number: e.target.value })} /></div>
              <div className="field"><label htmlFor="lm_cv">Nama berkas CV (wajib dilampirkan) *</label>
                <input id="lm_cv" required value={pelamar.cv_nama} onChange={(e) => setPelamar({ ...pelamar, cv_nama: e.target.value })} placeholder="mis. CV_NamaPelamar.pdf" /></div>
            </div>
            <div className="field"><span>Syarat mutlak — centang yang terpenuhi</span>
              {(low.syarat_mutlak || []).map((s) => (
                <label key={s} style={{ display: "block" }}>
                  <input type="checkbox" checked={Boolean(cekSyarat[s])} onChange={(e) => setCekSyarat((p) => ({ ...p, [s]: e.target.checked }))} /> {s}
                </label>
              ))}
            </div>
            <div className="field"><label htmlFor="lm_j1">Pertanyaan 1 — {PERTANYAAN_PERTAMA}</label>
              <textarea id="lm_j1" rows={3} required value={jawaban1} onChange={(e) => setJawaban1(e.target.value)} /></div>
            <button className="btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Menyimpan…" : "Simpan Lamaran (tersaring otomatis)"}</button>
          </form>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Alur Lamaran</h2>
        {lamaran === null ? <LoadingState /> : lamaran.length === 0 ? <p className="muted">Belum ada lamaran.</p> : (
          <table>
            <thead><tr><th>Pelamar</th><th>Lowongan</th><th>CV</th><th>Status Alur</th><th>Majukan ke</th></tr></thead>
            <tbody>
              {lamaran.map((l) => (
                <tr key={l.id}>
                  <td>{String(l.nama)}<div className="muted">{String(l.wa_number || l.email || "")}</div></td>
                  <td>{String(l.lowongan_judul)}</td>
                  <td>{l.cv_url ? <a href={`/api/rekrutmen/cv/${String(l.cv_url)}`}>{String(l.cv_nama)} ⬇</a> : String(l.cv_nama)}</td>
                  <td><span className={`badge ${l.status === "diterima" || l.status === "onboarding" ? "ok" : l.status === "tidak_memenuhi" || l.status === "ditolak" ? "warn" : "info"}`}>{ALUR.find(([k]) => k === l.status)?.[1] || String(l.status)}</span></td>
                  <td>
                    <select aria-label={`Majukan lamaran ${String(l.nama)}`} value="" disabled={busy || l.status === "tidak_memenuhi"}
                      onChange={(e) => { if (e.target.value) void maju(l.id, e.target.value); }}>
                      <option value="">Pilih tahap…</option>
                      {ALUR.filter(([k]) => k !== "tidak_memenuhi" && k !== l.status).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
