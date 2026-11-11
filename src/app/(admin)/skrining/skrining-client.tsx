"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { JENIS_SKRINING, LABEL_JENIS_SKRINING, STATUS_SKRINING } from "@/lib/skrining";

type Skr = Record<string, string | number | null> & { id: string };
type Ruj = Record<string, string | null> & { id: string };
type Cabang = { id: string; name: string };

const FLAT = { child_name: "", child_birth_date: "", parent_name: "", wa_number: "", email: "", jenis: "tumbuh_kembang", biaya: "", branch_id: "" };

export function SkriningClient({ bagian }: { bagian?: string }) {
  const [rows, setRows] = useState<Skr[] | null>(null);
  const [rujukan, setRujukan] = useState<Ruj[]>([]);
  const [branches, setBranches] = useState<Cabang[]>([]);
  const [f, setF] = useState(FLAT);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof FLAT, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(() => {
    fetch("/api/skrining").then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.skrining) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/rujukan").then((r) => r.json())
      .then((d) => { if (d.ok) setRujukan(d.rujukan); }).catch(() => undefined);
    fetch("/api/meta").then((r) => r.json())
      .then((d) => { if (d.ok) setBranches(d.branches || []); }).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/skrining", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, biaya: f.biaya ? Number(f.biaya) : undefined, branch_id: f.branch_id || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`Klien skrining ${f.child_name} terdaftar. Lanjutkan di ruang kerja skriningnya.`);
    setF(FLAT);
    load();
  }

  return (
    <>
      <PageHead
        title="Skrining & Rujukan"
        subtitle="Layanan Skrining Berdiri Sendiri — pemetaan dan deteksi dini, bukan diagnosis, bukan terapi, bukan janji hasil"
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Konsultasi dan Pemetaan Bakat Minat</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Layanan konsultasi tersendiri — bukan jenis skrining dan bukan bagian dari pemeriksaan skrining —
          mempunyai pintu masuknya sendiri pada menu <strong>Minat &amp; Bakat</strong>, dengan label layanannya
          sendiri, yaitu Klien Konsultasi.
        </p>
        <Link className="btn secondary" href="/minat-bakat">Buka Konsultasi dan Pemetaan Bakat Minat</Link>
      </div>

      <nav aria-label="Kamar-kamar Skrining" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "daftar" ? "btn" : "btn secondary"} href="/skrining/daftar">Klien & Pemeriksaan</a>
        <a className={bagian === "rujukan" ? "btn" : "btn secondary"} href="/skrining/rujukan">Berkas Rujukan</a>
        <a className="btn secondary" href="/skrining/bank">Bank Deteksi &amp; Rujukan</a>
        <a className="btn secondary" href="/minat-bakat">Minat & Bakat</a>
      </nav>

      {(!bagian || bagian === "daftar") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Daftarkan Klien Skrining</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Status anak pada jalur ini adalah <strong>Klien Skrining</strong> — berdiri sendiri, terpisah dari
          Anggota, Trial, Insidentil, dan Peserta Event. Biaya layanan adalah isian lembaga per jenis
          skrining; sistem tidak mempunyai angka bawaan.
        </p>
        <form onSubmit={kirim}>
          <div className="grid-form">
            <div className="field"><label htmlFor="sk_jenis">Jenis skrining *</label>
              <select id="sk_jenis" value={f.jenis} onChange={(e) => set("jenis", e.target.value)}>
                {JENIS_SKRINING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="field"><label htmlFor="sk_anak">Nama anak *</label>
              <input id="sk_anak" required value={f.child_name} onChange={(e) => set("child_name", e.target.value)} /></div>
            <div className="field"><label htmlFor="sk_lahir">Tanggal lahir anak</label>
              <input id="sk_lahir" type="date" value={f.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} /></div>
            <div className="field"><label htmlFor="sk_ortu">Nama orang tua *</label>
              <input id="sk_ortu" required value={f.parent_name} onChange={(e) => set("parent_name", e.target.value)} /></div>
            <div className="field"><label htmlFor="sk_wa">Nomor WhatsApp *</label>
              <input id="sk_wa" required value={f.wa_number} onChange={(e) => set("wa_number", e.target.value)} placeholder="62812…" /></div>
            <div className="field"><label htmlFor="sk_email">Email orang tua</label>
              <input id="sk_email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="field"><label htmlFor="sk_biaya">Biaya layanan (Rp, isian lembaga)</label>
              <input id="sk_biaya" type="number" min={0} value={f.biaya} onChange={(e) => set("biaya", e.target.value)} /></div>
            <div className="field"><label htmlFor="sk_cabang">Cabang</label>
              <select id="sk_cabang" value={f.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
                <option value="">Otomatis</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? "Menyimpan…" : "Daftarkan Klien"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Pemeriksaan Skrining</h2>
        {rows === null ? <LoadingState /> : rows.length === 0 ? (
          <p className="muted">Belum ada pemeriksaan. Setiap pemeriksaan berjalan mengikuti Tahapan Skrining 1–5 yang terkunci urutannya.</p>
        ) : (
          <table>
            <thead><tr><th>Anak</th><th>Jenis Skrining</th><th>Status</th><th>Laporan</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{String(s.child_name)}<div className="muted">{String(s.parent_name)} · {String(s.wa_number)}</div></td>
                  <td>{LABEL_JENIS_SKRINING[String(s.jenis)] || String(s.jenis)}</td>
                  <td><span className={`badge ${s.status === "selesai" ? "ok" : s.status === "berjalan" ? "info" : "warn"}`}>{STATUS_SKRINING[String(s.status)] || String(s.status)}</span></td>
                  <td>{s.laporan_status === "final" ? "Final" : s.laporan_status === "draft" ? "Draf" : "—"}</td>
                  <td><Link className="btn small secondary" href={`/skrining/${s.id}`}>Ruang Kerja</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </>)}

      {(!bagian || bagian === "rujukan") && (<>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Berkas Rujukan</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Berkas dibangkitkan dari profil anak begitu pemicu tercapai. Kolom tujuan selalu <strong>kosong</strong> pada
          draf dan baru diisi saat berkas diterbitkan oleh founder, sesudah laporan observasi lengkap terlampir dan
          persetujuan tertulis orang tua tercatat. Buat berkas baru dari halaman profil anak atau dari ruang kerja skrining.
        </p>
        {rujukan.length === 0 ? <p className="muted">Belum ada berkas rujukan.</p> : (
          <table>
            <thead><tr><th>Anak</th><th>Pemicu</th><th>Tujuan</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rujukan.map((r) => (
                <tr key={r.id}>
                  <td>{r.child_name}</td>
                  <td>{String(r.pemicu || "").slice(0, 80)}</td>
                  <td>{r.tujuan || <span className="muted">(kosong — terisi saat terbit)</span>}</td>
                  <td><span className={`badge ${r.status === "terkirim" ? "ok" : r.status === "siap_kirim" ? "info" : "warn"}`}>{r.status === "siap_kirim" ? "Siap Kirim" : r.status === "terkirim" ? "Terkirim" : "Draf"}</span></td>
                  <td><Link className="btn small secondary" href={`/skrining/rujukan/${r.id}`}>Kelola</Link></td>
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
