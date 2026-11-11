"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { JENIS_SESI, type JenisSesi } from "@/lib/jadwal";
import { tanggalPanjang } from "@/lib/format";

type Sesi = {
  id: string; jenis: string; label: string; tanggal: string;
  jam_mulai: string; jam_selesai: string; kuota: number;
  terisi: number; menunggu: number; sisa_kuota: number; catatan: string | null;
};
type Peserta = {
  id: string; nama_anak: string; status: string; urutan_tunggu: number | null; lead_id: string | null;
};
type Lead = { id: string; child_name: string | null; parent_name: string | null };

const JENIS_LIST = Object.entries(JENIS_SESI) as Array<[JenisSesi, (typeof JENIS_SESI)[JenisSesi]]>;

export default function JadwalSesiPage() {
  const [sesi, setSesi] = useState<Sesi[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [jenis, setJenis] = useState<JenisSesi>("trial_zkc");
  const [tanggal, setTanggal] = useState("");
  const [jamMulai, setJamMulai] = useState("08:00");
  const [kuota, setKuota] = useState("10");
  const [catatan, setCatatan] = useState("");

  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [leadPilih, setLeadPilih] = useState("");

  const load = useCallback(() => {
    fetch("/api/admission/sesi")
      .then((r) => r.json())
      .then((d) => (d.ok ? setSesi(d.sesi) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/admission")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setLeads(d.leads || []); })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  function gantiJenis(j: JenisSesi) {
    setJenis(j);
    setKuota(String(JENIS_SESI[j].kuotaBawaan));
  }

  async function buatSesi(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/admission/sesi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jenis, tanggal, jam_mulai: jamMulai, kuota: Number(kuota), catatan: catatan || null }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(`Sesi dibuat, berakhir pukul ${d.jam_selesai}.`);
    setCatatan("");
    load();
  }

  async function bukaPeserta(id: string) {
    if (terbuka === id) { setTerbuka(null); return; }
    setTerbuka(id);
    setPeserta([]);
    const res = await fetch(`/api/admission/sesi/${id}`);
    const d = await res.json();
    if (d.ok) setPeserta(d.peserta || []);
    else setError(d.error);
  }

  async function tambahPeserta(sesiId: string) {
    if (!leadPilih) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admission/sesi/${sesiId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadPilih }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(d.status === "daftar_tunggu"
      ? `Kuota sesi sudah penuh — peserta masuk daftar tunggu urutan ${d.urutan_tunggu}.`
      : "Peserta terkonfirmasi pada sesi.");
    setLeadPilih("");
    load();
    const detail = await (await fetch(`/api/admission/sesi/${sesiId}`)).json();
    if (detail.ok) setPeserta(detail.peserta || []);
  }

  async function batalPeserta(sesiId: string, pesertaId: string) {
    setBusy(true);
    const res = await fetch(`/api/admission/sesi/${sesiId}/peserta/${pesertaId}`, { method: "DELETE" });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(d.naik_dari_tunggu ? `Peserta dibatalkan. ${d.naik_dari_tunggu} naik dari daftar tunggu.` : "Peserta dibatalkan.");
    load();
    const detail = await (await fetch(`/api/admission/sesi/${sesiId}`)).json();
    if (detail.ok) setPeserta(detail.peserta || []);
  }

  async function hapusSesi(id: string) {
    if (!window.confirm("Hapus sesi ini beserta seluruh pesertanya?")) return;
    const res = await fetch(`/api/admission/sesi/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!d.ok) { setError(d.error); return; }
    setTerbuka(null);
    load();
  }

  if (error && !sesi) return (<><PageHead title="Jadwal Sesi" /><ErrorState message={error} /></>);
  if (!sesi) return (<><PageHead title="Jadwal Sesi" /><LoadingState /></>);

  const infoJenis = JENIS_SESI[jenis];

  return (
    <>
      <PageHead
        title="Jadwal Sesi & Kuota"
        subtitle="Kuota adalah janji kualitas observasi. Aturan terkunci: tidak ada sesi pada jam istirahat guru 12.00–13.00; Pendampingan Individual dan Kelas Movement hanya sesudah pukul 13.00."
      />
      <p style={{ marginTop: 0 }}><Link href="/admission">← Kembali ke pipeline Admission</Link></p>
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Buat sesi</h2>
        <form onSubmit={buatSesi}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="js_jenis">Jenis sesi</label>
              <select id="js_jenis" value={jenis} onChange={(e) => gantiJenis(e.target.value as JenisSesi)}>
                {JENIS_LIST.map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.durasiMenit} menit</option>
                ))}
              </select>
              <small className="muted">
                Durasi terkunci {infoJenis.durasiMenit} menit{infoJenis.sesudah13 ? " · hanya sesudah 13.00" : ""}. Trial & Asesmen ZKC adalah dua slot terpisah, bukan satu blok.
              </small>
            </div>
            <div className="field">
              <label htmlFor="js_tgl">Tanggal</label>
              <input id="js_tgl" type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="js_jam">Jam mulai</label>
              <input id="js_jam" type="time" required value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="js_kuota">Kuota anak</label>
              <input id="js_kuota" type="number" min="1" max="60" value={kuota} onChange={(e) => setKuota(e.target.value)} />
              <small className="muted">Bawaan resmi: {infoJenis.kuotaBawaan} anak per sesi.</small>
            </div>
            <div className="field">
              <label htmlFor="js_cat">Catatan</label>
              <input id="js_cat" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Guru pendamping, ruangan, dsb." />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>
            {busy ? "Menyimpan…" : "Buat Sesi"}
          </button>
        </form>
      </div>

      <h2 style={{ marginTop: 20 }}>Sesi mendatang</h2>
      {sesi.length === 0 ? (
        <EmptyState title="Belum ada sesi terjadwal" body="Buat sesi pertama di atas. Sisa kuota tampil nyata dan peserta berlebih masuk daftar tunggu berurutan." />
      ) : (
        sesi.map((s) => (
          <div className="card" key={s.id} style={{ marginBottom: 10 }}>
            <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{s.label}</strong>
                <div className="muted">
                  {tanggalPanjang(s.tanggal)} · {String(s.jam_mulai).slice(0, 5)}–{String(s.jam_selesai).slice(0, 5)}
                  {s.catatan ? ` · ${s.catatan}` : ""}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className={s.sisa_kuota > 0 ? "badge ok" : "badge danger"}>
                  Terisi {s.terisi}/{s.kuota} · sisa {s.sisa_kuota}
                </span>
                {s.menunggu > 0 ? <span className="badge warn">Daftar tunggu: {s.menunggu}</span> : null}
                <button className="btn small secondary" type="button" onClick={() => void bukaPeserta(s.id)}>
                  {terbuka === s.id ? "Tutup" : "Kelola Peserta"}
                </button>
                <button className="btn small danger" type="button" onClick={() => void hapusSesi(s.id)}>Hapus</button>
              </div>
            </div>
            {terbuka === s.id ? (
              <div style={{ marginTop: 12 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <select value={leadPilih} onChange={(e) => setLeadPilih(e.target.value)} aria-label="Pilih lead sebagai peserta">
                    <option value="">Pilih anak dari pipeline…</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.child_name || "(belum bernama)"} · {l.parent_name || "-"}</option>
                    ))}
                  </select>
                  <button className="btn small" type="button" disabled={busy || !leadPilih} onClick={() => void tambahPeserta(s.id)}>
                    Daftarkan ke Sesi
                  </button>
                </div>
                {peserta.length === 0 ? (
                  <p className="muted">Belum ada peserta pada sesi ini.</p>
                ) : (
                  <table style={{ marginTop: 10 }}>
                    <thead><tr><th>Anak</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {peserta.map((p) => (
                        <tr key={p.id}>
                          <td>{p.nama_anak}</td>
                          <td>
                            {p.status === "terkonfirmasi" ? <span className="badge ok">Terkonfirmasi</span>
                              : p.status === "daftar_tunggu" ? <span className="badge warn">Daftar tunggu #{p.urutan_tunggu}</span>
                              : p.status === "batal" ? <span className="badge danger">Batal</span>
                              : <span className="badge neutral">{p.status}</span>}
                          </td>
                          <td>
                            {p.status !== "batal" ? (
                              <button className="btn small danger" type="button" disabled={busy} onClick={() => void batalPeserta(s.id, p.id)}>Batalkan</button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
