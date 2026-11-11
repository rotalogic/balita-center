"use client";

import { useState } from "react";
import { usePublik } from "@/components/publik-data";

type Low = {
  id: string; judul: string; program_label: string | null; deskripsi: string | null;
  syarat_mutlak: string[]; pertanyaan: string[];
};

export default function KarierFormDanKartu() {
  const data = usePublik();
  const [pilih, setPilih] = useState("");
  const [f, setF] = useState({ nama: "", email: "", wa_number: "", pendidikan: "", pengalaman: "" });
  const [cek, setCek] = useState<Record<string, boolean>>({});
  const [jawaban, setJawaban] = useState<string[]>([]);
  const [cv, setCv] = useState<{ cv_url: string; cv_nama: string } | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  if (!data) return <p>Sedang memuat posisi yang dibuka…</p>;
  const lowongan = (data.lowongan as unknown as Low[]) || [];
  const low = lowongan.find((l) => l.id === pilih);

  async function unggahCv(file: File) {
    setCvBusy(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/publik/unggah-cv", { method: "POST", body: fd });
    const d = await res.json();
    setCvBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setCv({ cv_url: d.cv_url, cv_nama: d.cv_nama });
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!low) return;
    if (!cv) { setError("CV wajib dilampirkan — unggah berkas CV terlebih dahulu."); return; }
    setBusy(true); setError(null);
    const res = await fetch("/api/publik/lamaran", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowongan_id: low.id, ...f, syarat: cek, jawaban, cv_nama: cv.cv_nama, cv_url: cv.cv_url }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setSukses(true);
  }

  return (
    <>
      <div className="pb-grid">
        {lowongan.map((l) => (
          <article className="pb-card" key={l.id}>
            <h3>{l.judul}</h3>
            <p style={{ marginBottom: 8 }}><em>{l.program_label || ""}</em></p>
            <p>{l.deskripsi}</p>
            <p style={{ marginTop: 8 }}><strong>Persyaratan pokok:</strong></p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 18, color: "#57462f", fontSize: 14.5 }}>
              {(l.syarat_mutlak || []).map((s) => <li key={s}>{s}</li>)}
            </ul>
            <button className="pb-btn" type="button" onClick={() => { setPilih(l.id); setJawaban([]); setCek({}); }}>
              Lamar Posisi Ini
            </button>
          </article>
        ))}
      </div>

      <div className="pb-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Formulir Lamaran Lengkap</h3>
        <p style={{ color: "#57462f", marginTop: 0 }}>
          Alur melamar tidak berjalan lewat WhatsApp admin. Isi formulir ini langsung di halaman ini — lamaran
          terkirim masuk ke modul Rekrutmen lembaga dan berjalan pada alur seleksinya. Lembaga tidak menampilkan
          gaji dalam bentuk apa pun dan tidak menampilkan data pelamar mana pun.
        </p>
        {sukses ? (
          <div className="pb-ok" role="status">
            <h3 style={{ marginTop: 0 }}>Lamaran Terkirim</h3>
            <p style={{ margin: 0 }}>Terima kasih — lamaran Anda sudah masuk ke alur rekrutmen lembaga. Tim kami akan menghubungi pelamar yang tersaring untuk tahap berikutnya.</p>
          </div>
        ) : (
          <form onSubmit={kirim}>
            {error ? <p className="pb-err" role="alert">{error}</p> : null}
            <div className="pb-field"><label htmlFor="kr_posisi">Posisi yang dilamar *</label>
              <select id="kr_posisi" required value={pilih} onChange={(e) => { setPilih(e.target.value); setJawaban([]); setCek({}); }}>
                <option value="">— Pilih posisi —</option>
                {lowongan.map((l) => <option key={l.id} value={l.id}>{l.judul}</option>)}
              </select></div>
            <div className="pb-form2">
              <div className="pb-field"><label htmlFor="kr_nama">Nama lengkap *</label>
                <input id="kr_nama" required value={f.nama} onChange={(e) => set("nama", e.target.value)} /></div>
              <div className="pb-field"><label htmlFor="kr_email">Email</label>
                <input id="kr_email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="pb-field"><label htmlFor="kr_wa">Nomor WhatsApp</label>
                <input id="kr_wa" value={f.wa_number} onChange={(e) => set("wa_number", e.target.value)} /></div>
              <div className="pb-field"><label htmlFor="kr_pendidikan">Pendidikan</label>
                <input id="kr_pendidikan" value={f.pendidikan} onChange={(e) => set("pendidikan", e.target.value)} /></div>
            </div>
            <div className="pb-field"><label htmlFor="kr_pengalaman">Pengalaman</label>
              <textarea id="kr_pengalaman" rows={2} value={f.pengalaman} onChange={(e) => set("pengalaman", e.target.value)} /></div>
            <div className="pb-field"><label htmlFor="kr_cv">Unggah berkas CV (PDF/DOC/DOCX, maks 5 MB) *</label>
              <input id="kr_cv" type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void unggahCv(fl); }} />
              {cvBusy ? <p>Sedang mengunggah…</p> : cv ? <p style={{ color: "#4F7A54" }}>CV terunggah: {cv.cv_nama}</p> : null}
            </div>
            {low ? (
              <>
                <div className="pb-field"><span style={{ fontWeight: 600, fontSize: 14 }}>Persyaratan pokok — centang yang terpenuhi pada diri Anda</span>
                  {(low.syarat_mutlak || []).map((s) => (
                    <p className="pb-cek" key={s}>
                      <input id={`kr_s_${s}`} type="checkbox" checked={Boolean(cek[s])} onChange={(e) => setCek((p) => ({ ...p, [s]: e.target.checked }))} />
                      <label htmlFor={`kr_s_${s}`}>{s}</label>
                    </p>
                  ))}
                </div>
                {(low.pertanyaan || []).map((p, i) => (
                  <div className="pb-field" key={i}>
                    <label htmlFor={`kr_p_${i}`}>Pertanyaan {i + 1} — {p}</label>
                    <textarea id={`kr_p_${i}`} rows={3} required={i === 0} value={jawaban[i] || ""}
                      onChange={(e) => setJawaban((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} />
                  </div>
                ))}
              </>
            ) : null}
            <button className="pb-btn" type="submit" disabled={busy || !low} style={{ marginTop: 8 }}>
              {busy ? "Mengirim…" : "Kirim Lamaran"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
