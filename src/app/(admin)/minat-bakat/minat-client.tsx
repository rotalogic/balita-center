"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import {
  KEKUATAN_LENGKAP, LANGKAH_KONSULTASI, NAMA_LAYANAN, PEMROSESAN, PLAKAT_NOTICEABILITY, RANAH_MENONJOL,
} from "@/lib/minat";

type Kon = Record<string, string | number | null> & { id: string };
type Cabang = { id: string; name: string };
type Anak = { id: string; full_name: string; birth_date: string | null };

const FLAT = { child_name: "", child_birth_date: "", parent_name: "", wa_number: "", email: "", biaya: "", branch_id: "", child_id: "" };

export function MinatClient({ bagian }: { bagian?: string }) {
  const [rows, setRows] = useState<Kon[] | null>(null);
  const [branches, setBranches] = useState<Cabang[]>([]);
  const [anak, setAnak] = useState<Anak[]>([]);
  const [f, setF] = useState(FLAT);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof FLAT, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(() => {
    fetch("/api/konsultasi").then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.konsultasi) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/meta").then((r) => r.json())
      .then((d) => { if (d.ok) setBranches(d.branches || []); }).catch(() => undefined);
    fetch("/api/children").then((r) => r.json())
      .then((d) => { if (d.ok) setAnak((d.children || []).map((c: Anak) => ({ id: c.id, full_name: c.full_name, birth_date: c.birth_date }))); })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch("/api/konsultasi", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, biaya: f.biaya ? Number(f.biaya) : undefined, branch_id: f.branch_id || undefined, child_id: f.child_id || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`Klien Konsultasi ${f.child_name} terdaftar. Lanjutkan di meja kerja konsultasinya.`);
    setF(FLAT);
    load();
  }

  return (
    <>
      <PageHead title={NAMA_LAYANAN} subtitle="Menu Minat & Bakat — layanan konsultasi tersendiri yang diterima langsung oleh pendiri" />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <nav aria-label="Kamar-kamar Minat dan Bakat" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "layanan" ? "btn" : "btn secondary"} href="/minat-bakat/layanan">Kartu Layanan</a>
        <a className={bagian === "klien" ? "btn" : "btn secondary"} href="/minat-bakat/klien">Klien Konsultasi</a>
      </nav>

      {(!bagian || bagian === "layanan") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Kartu Layanan</h2>
        <p style={{ marginTop: 0 }}>
          Layanan ini membantu orang tua dan anak atau remaja memahami <strong>kekuatan serta arah minat</strong> anaknya.
          Yang diterima keluarga: <strong>Peta Kekuatan dan Minat</strong> beserta <strong>Rekomendasi Pengarahan</strong> yang konkret —
          pilihan kegiatan dan ekstrakurikuler yang sesuai, program pendampingan di lembaga bila relevan, dan arah persiapan jenjang berikutnya.
        </p>
        <p>
          Seluruh bahasa layanan ini adalah bahasa konsultasi dan pemetaan non klinis: membaca kekuatan dan minat anak
          untuk pengarahan kegiatan dan pengembangan dirinya — <strong>bukan asesmen psikologis, bukan diagnosis, dan bukan
          penentuan bakat yang bersifat tetap atau mengikat masa depan anak</strong>. Satu-satunya instrumen yang dipakai adalah
          perangkat observasi dan wawancara milik lembaga sendiri.
        </p>
        <p><strong>Dibuka mulai usia empat tahun.</strong> Anak berusia di bawah empat tahun tidak didaftarkan pada layanan
          tersendiri ini — minat dan cara belajarnya dibaca lewat Profil Cara Belajar pada laporan program kelas yang ia ikuti.
          Aturan ini ditegakkan formulir pendaftaran di lapisan server.</p>
        <p className="muted" style={{ fontSize: 13 }}>{PLAKAT_NOTICEABILITY}</p>
        <h3>Alur Layanan — Empat Langkah</h3>
        <ol style={{ marginTop: 4 }}>
          {LANGKAH_KONSULTASI.map(([n, nama, ket]) => (
            <li key={n}><strong>{nama}.</strong> <span className="muted">{ket}</span></li>
          ))}
        </ol>
        <h3>Kelompok Pemetaan Lembaga</h3>
        <ul style={{ marginTop: 4 }}>
          <li><strong>Lensa Kekuatan &amp; Kecenderungan Arah:</strong> {KEKUATAN_LENGKAP.map((k) => k.nama.replace("Kekuatan ", "")).join(" · ")}</li>
          <li><strong>Lensa Kecenderungan Pemrosesan:</strong> {PEMROSESAN.join(" · ")}</li>
          <li><strong>Lensa Cara Belajar Anak:</strong> jalur belajar dominan beserta jalur pendukungnya (Profil Cara Belajar lembaga)</li>
          <li><strong>Lensa Temperamen Anak:</strong> ritme, intensitas reaksi, kemampuan beradaptasi, pendekatan terhadap hal baru</li>
          <li><strong>Lensa Ranah yang Menonjol:</strong> {RANAH_MENONJOL.join(" · ")} — dibaca sebagai wilayah minat yang sedang tumbuh, bukan angka kecerdasan</li>
        </ul>
        <p className="muted">
          <strong>Kecenderungan Arah</strong> selalu dinyatakan sebagai kecenderungan yang teramati untuk dikembangkan lewat
          pilihan kegiatan dan pengalaman berikutnya — bukan ramalan profesi, bukan penentuan masa depan, dan bukan label tetap.
          Bagi anak usia empat dan lima tahun, kecenderungan arah dibaca sebagai <em>kecenderungan awal</em> yang masih sangat terbuka.
        </p>
      </div>

      </>)}

      {(!bagian || bagian === "klien") && (<>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Daftarkan Klien Konsultasi</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Label layanannya adalah <strong>Klien Konsultasi</strong> — terpisah dari Klien Skrining — dan berkasnya tetap satu
          profil anak yang sama. Biaya layanan adalah isian lembaga; sistem tidak mempunyai angka bawaan. Untuk anak
          anggota, pilih namanya agar berkas konsultasi menempel pada profilnya.
        </p>
        <form onSubmit={kirim}>
          <div className="grid-form">
            <div className="field"><label htmlFor="mb_anggota">Anak anggota (opsional — berkas menempel ke profilnya)</label>
              <select id="mb_anggota" value={f.child_id} onChange={(e) => {
                const a = anak.find((x) => x.id === e.target.value);
                setF((p) => ({ ...p, child_id: e.target.value, child_name: a ? a.full_name : p.child_name, child_birth_date: a?.birth_date ? String(a.birth_date).slice(0, 10) : p.child_birth_date }));
              }}>
                <option value="">— Bukan anak anggota / isi manual —</option>
                {anak.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="mb_anak">Nama anak *</label>
              <input id="mb_anak" required value={f.child_name} onChange={(e) => set("child_name", e.target.value)} /></div>
            <div className="field"><label htmlFor="mb_lahir">Tanggal lahir anak * (gerbang usia ≥ 4 tahun)</label>
              <input id="mb_lahir" type="date" required value={f.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} /></div>
            <div className="field"><label htmlFor="mb_ortu">Nama orang tua *</label>
              <input id="mb_ortu" required value={f.parent_name} onChange={(e) => set("parent_name", e.target.value)} /></div>
            <div className="field"><label htmlFor="mb_wa">Nomor WhatsApp *</label>
              <input id="mb_wa" required value={f.wa_number} onChange={(e) => set("wa_number", e.target.value)} placeholder="62812…" /></div>
            <div className="field"><label htmlFor="mb_email">Email orang tua</label>
              <input id="mb_email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="field"><label htmlFor="mb_biaya">Biaya layanan (Rp, isian lembaga)</label>
              <input id="mb_biaya" type="number" min={0} value={f.biaya} onChange={(e) => set("biaya", e.target.value)} /></div>
            <div className="field"><label htmlFor="mb_cabang">Cabang</label>
              <select id="mb_cabang" value={f.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
                <option value="">Otomatis</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? "Menyimpan…" : "Daftarkan Klien Konsultasi"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Klien Konsultasi Terdaftar</h2>
        {rows === null ? <LoadingState /> : rows.length === 0 ? (
          <p className="muted">Belum ada klien konsultasi terdaftar.</p>
        ) : (
          <table>
            <thead><tr><th>Anak</th><th>Orang Tua · WA</th><th>Tanggal Lahir</th><th>Status</th><th>Laporan Konsultasi</th><th /></tr></thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id}>
                  <td>{String(k.child_name)}{k.child_id ? <div className="muted">anak anggota</div> : null}</td>
                  <td>{String(k.parent_name)}<div className="muted">{String(k.wa_number)}</div></td>
                  <td>{k.child_birth_date ? tanggalPanjang(String(k.child_birth_date)) : "—"}</td>
                  <td><span className={`badge ${k.status === "selesai" ? "ok" : k.status === "pemetaan" ? "info" : "warn"}`}>{k.status === "selesai" ? "Selesai" : k.status === "pemetaan" ? "Pemetaan Berjalan" : "Pendaftaran"}</span></td>
                  <td>{k.laporan_status === "final" ? "Final" : k.laporan_status === "draft" ? "Draf" : "—"}</td>
                  <td><Link className="btn small secondary" href={`/minat-bakat/${k.id}`}>Meja Kerja</Link></td>
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
