"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang, tanggalPendek } from "@/lib/format";
import LencanaAlergi from "@/components/lencana-alergi";

type Baris = {
  id: string; child_name: string; parent_name: string; wa_number: string;
  kegiatan_jenis: string; kegiatan_label: string | null; tanggal: string;
  berbayar: boolean; status: string; alergi_tidak_ada: boolean; alergi_jenis: string | null;
  paket_terkirim: boolean; child_id: string | null; nama_anggota: string | null;
};

const JENIS: Array<[string, string]> = [
  ["zkc", "Kegiatan Ziel Kids Club"],
  ["sam", "Kegiatan Sekolah Alam Montessori"],
  ["pop_up", "Pop Up Class"],
  ["event_alam", "Event Alam"],
  ["edukasi", "Acara Edukasi"],
];
const LABEL_JENIS: Record<string, string> = Object.fromEntries(JENIS);

export default function InsidentilPage() {
  const [rows, setRows] = useState<Baris[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    child_name: "", child_birth_date: "", child_age_months: "", parent_name: "",
    wa_number: "", email: "", kegiatan_jenis: "zkc", kegiatan_label: "", tanggal: "",
    berbayar: false, biaya: "", setuju_ketentuan_bayar: false,
    alergi_tidak_ada: false, alergi_jenis: "", alergi_pemicu: "", alergi_reaksi: "", alergi_tindakan: "",
    setuju_dokumentasi: false, catatan: "", event_edisi_id: "", tarif_jenis: "reguler",
  });
  const [edisiBuka, setEdisiBuka] = useState<Array<{ id: string; nama: string; tanggal: string | null }>>([]);
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  const load = useCallback(() => {
    fetch("/api/admission/insidentil")
      .then((r) => r.json())
      .then((d) => (d.ok ? setRows(d.insidentil) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/event")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setEdisiBuka(
            (d.edisi as Array<{ id: string; nama: string; tanggal: string | null; status: string }>)
              .filter((e) => e.status === "buka")
              .map((e) => ({ id: e.id, nama: e.nama, tanggal: e.tanggal }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function kirim(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/admission/insidentil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        biaya: f.biaya ? Number(f.biaya) : null,
        child_age_months: f.child_age_months ? Number(f.child_age_months) : undefined,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`Pendaftaran insidentil ${f.child_name} tersimpan.`);
    setF({
      child_name: "", child_birth_date: "", child_age_months: "", parent_name: "",
      wa_number: "", email: "", kegiatan_jenis: "zkc", kegiatan_label: "", tanggal: "",
      berbayar: false, biaya: "", setuju_ketentuan_bayar: false,
      alergi_tidak_ada: false, alergi_jenis: "", alergi_pemicu: "", alergi_reaksi: "", alergi_tindakan: "",
      setuju_dokumentasi: false, catatan: "", event_edisi_id: "", tarif_jenis: "reguler",
    });
    load();
  }

  if (error && !rows) return (<><PageHead title="Formulir Insidentil" /><ErrorState message={error} /></>);
  if (!rows) return (<><PageHead title="Formulir Insidentil" /><LoadingState /></>);

  return (
    <>
      <PageHead
        title="Formulir Insidentil"
        subtitle="Jalur ringan untuk anak yang mencoba kegiatan ZKC, SAM, Pop Up Class, event alam, dan acara edukasi — terpisah dari Formulir Trial"
      />
      <p style={{ marginTop: 0 }}><Link href="/admission">← Kembali ke pipeline Admission</Link></p>
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <form onSubmit={kirim} className="card">
        <h2 style={{ marginTop: 0 }}>Pendaftaran baru</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="in_anak">Nama anak *</label>
            <input id="in_anak" required value={f.child_name} onChange={(e) => set("child_name", e.target.value)} /></div>
          <div className="field"><label htmlFor="in_lahir">Tanggal lahir anak</label>
            <input id="in_lahir" type="date" value={f.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} />
            <small className="muted">Umur terhitung otomatis bila tanggal lahir diisi.</small></div>
          <div className="field"><label htmlFor="in_umur">Umur anak (bulan, bila tanggal lahir belum tahu)</label>
            <input id="in_umur" type="number" min="0" max="240" value={f.child_age_months} onChange={(e) => set("child_age_months", e.target.value)} /></div>
          <div className="field"><label htmlFor="in_ortu">Nama orang tua *</label>
            <input id="in_ortu" required value={f.parent_name} onChange={(e) => set("parent_name", e.target.value)} /></div>
          <div className="field"><label htmlFor="in_wa">Nomor WhatsApp orang tua *</label>
            <input id="in_wa" required placeholder="62812..." value={f.wa_number} onChange={(e) => set("wa_number", e.target.value)} /></div>
          <div className="field"><label htmlFor="in_email">Email orang tua</label>
            <input id="in_email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="field"><label htmlFor="in_jenis">Pilihan kegiatan *</label>
            <select id="in_jenis" value={f.kegiatan_jenis} onChange={(e) => set("kegiatan_jenis", e.target.value)}>
              {JENIS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select></div>
          <div className="field"><label htmlFor="in_label">Nama kegiatan / edisi</label>
            <input id="in_label" value={f.kegiatan_label} onChange={(e) => set("kegiatan_label", e.target.value)} placeholder="mis. Pop Up Class Edisi 3 — Sensory Play" /></div>
          <div className="field"><label htmlFor="in_edisi">Edisi Program Event (pendaftaran peserta edisi)</label>
            <select id="in_edisi" value={f.event_edisi_id} onChange={(e) => set("event_edisi_id", e.target.value)}>
              <option value="">— Bukan peserta edisi —</option>
              {edisiBuka.map((e) => (<option key={e.id} value={e.id}>{e.nama}</option>))}
            </select>
            <small className="muted">Memilih edisi membuat anak terdaftar sebagai peserta edisi itu dan mengurangi sisa kuota; tanggal &amp; HTM mengikuti edisi.</small></div>
          {f.event_edisi_id ? (
            <div className="field"><label htmlFor="in_tarif">Jenis tarif edisi</label>
              <select id="in_tarif" value={f.tarif_jenis} onChange={(e) => set("tarif_jenis", e.target.value)}>
                <option value="reguler">Reguler</option>
                <option value="early_bird">Early Bird</option>
              </select></div>
          ) : null}
          <div className="field"><label htmlFor="in_tgl">Tanggal kegiatan *</label>
            <input id="in_tgl" type="date" required value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} /></div>
        </div>

        <h3>Alergi Anak (kolom berdiri sendiri, wajib diisi)</h3>
        <label>
          <input type="checkbox" checked={f.alergi_tidak_ada} onChange={(e) => set("alergi_tidak_ada", e.target.checked)} />{" "}
          Tidak Ada Alergi yang Diketahui
        </label>
        {!f.alergi_tidak_ada ? (
          <div className="form-grid" style={{ marginTop: 8 }}>
            <div className="field"><label htmlFor="al_jenis">Jenis alergi *</label>
              <input id="al_jenis" value={f.alergi_jenis} onChange={(e) => set("alergi_jenis", e.target.value)} placeholder="mis. kacang, susu sapi, debu" /></div>
            <div className="field"><label htmlFor="al_pemicu">Pemicu spesifik</label>
              <input id="al_pemicu" value={f.alergi_pemicu} onChange={(e) => set("alergi_pemicu", e.target.value)} /></div>
            <div className="field"><label htmlFor="al_reaksi">Reaksi yang biasa muncul</label>
              <input id="al_reaksi" value={f.alergi_reaksi} onChange={(e) => set("alergi_reaksi", e.target.value)} /></div>
            <div className="field"><label htmlFor="al_tindakan">Tindakan yang biasa dilakukan orang tua</label>
              <input id="al_tindakan" value={f.alergi_tindakan} onChange={(e) => set("alergi_tindakan", e.target.value)} /></div>
          </div>
        ) : null}

        <h3>Pembayaran & Persetujuan</h3>
        <div className="form-grid">
          <div className="field">
            <label><input type="checkbox" checked={f.berbayar} onChange={(e) => set("berbayar", e.target.checked)} /> Kegiatan berbayar</label>
            {f.berbayar ? (
              <input type="number" min="0" aria-label="Biaya kegiatan" placeholder="Biaya (Rp)" value={f.biaya} onChange={(e) => set("biaya", e.target.value)} style={{ marginTop: 6 }} />
            ) : null}
          </div>
          <div className="field">
            <label><input type="checkbox" checked={f.setuju_dokumentasi} onChange={(e) => set("setuju_dokumentasi", e.target.checked)} /> Orang tua menyetujui dokumentasi foto kegiatan anak</label>
          </div>
        </div>
        {f.berbayar ? (
          <div className="card" style={{ background: "var(--cream, #faf6ef)", marginTop: 10 }}>
            <p style={{ marginTop: 0 }}>
              Ketentuan kegiatan berbayar: pembayaran yang sudah dilakukan <strong>tidak dapat dibatalkan
              dan tidak dapat dikembalikan</strong>.
            </p>
            <label>
              <input type="checkbox" checked={f.setuju_ketentuan_bayar} onChange={(e) => set("setuju_ketentuan_bayar", e.target.checked)} />{" "}
              Orang tua sudah membaca dan menyetujui ketentuan ini (wajib untuk kegiatan berbayar)
            </label>
          </div>
        ) : null}

        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="in_cat">Catatan</label>
          <input id="in_cat" value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? "Menyimpan…" : "Simpan Pendaftaran Insidentil"}
        </button>
      </form>

      <h2 style={{ marginTop: 22 }}>Daftar Insidentil</h2>
      {rows.length === 0 ? (
        <EmptyState title="Belum ada pendaftaran insidentil" body="Pendaftaran pertama akan tampil di sini beserta penanda alerginya." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Tanggal</th><th>Anak</th><th>Orang tua</th><th>Kegiatan</th><th>Alergi</th><th>Status</th><th>Paket Edukasi</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{tanggalPendek(r.tanggal)}<div className="muted">{tanggalPanjang(r.tanggal)}</div></td>
                  <td><strong>{r.child_name}</strong>{r.nama_anggota ? <div className="muted">Anggota: {r.nama_anggota}</div> : null}</td>
                  <td>{r.parent_name}<div className="muted mono">{r.wa_number}</div></td>
                  <td>{r.kegiatan_label || LABEL_JENIS[r.kegiatan_jenis] || r.kegiatan_jenis}{r.berbayar ? <div className="muted">Berbayar</div> : null}</td>
                  <td><LencanaAlergi tidakAda={r.alergi_tidak_ada} jenis={r.alergi_jenis} /></td>
                  <td><span className={r.status === "jadi_anggota" ? "badge ok" : r.status === "batal" ? "badge danger" : "badge warn"}>{r.status.replace(/_/g, " ")}</span></td>
                  <td>{r.paket_terkirim ? <span className="badge ok">Terkirim</span> : <span className="muted">Belum</span>}</td>
                  <td><Link className="btn small secondary" href={`/admission/insidentil/${r.id}`}>Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
