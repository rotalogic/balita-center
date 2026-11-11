"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { LABEL_JENIS_SKRINING, TUJUAN_CEPAT_RUJUKAN } from "@/lib/skrining";

type Ruj = Record<string, unknown> & { id: string; status: string; child_name: string };
type LapRingkas = { id: string; child_name: string; jenis: string };

export default function RujukanDetailPage({ params }: { params: { id: string } }) {
  const [ruj, setRuj] = useState<Ruj | null>(null);
  const [tersedia, setTersedia] = useState<LapRingkas[]>([]);
  const [pemicu, setPemicu] = useState("");
  const [observasi, setObservasi] = useState("");
  const [lampiranId, setLampiranId] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [tujuan, setTujuan] = useState("");
  const [saluran, setSaluran] = useState("whatsapp");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/rujukan/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        const b = d.rujukan as Ruj;
        setRuj(b);
        setTersedia((d.laporan_tersedia || []) as LapRingkas[]);
        setPemicu(String(b.pemicu || ""));
        setObservasi(String(b.laporan_observasi || ""));
        setLampiranId(String(b.laporan_skrining_id || ""));
        setSetuju(Boolean(b.persetujuan_ortu_tercatat));
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/rujukan/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setInfo(pesan);
    load();
  }

  if (error && !ruj) return (<><PageHead title="Berkas Rujukan" /><ErrorState message={error} /></>);
  if (!ruj) return (<><PageHead title="Berkas Rujukan" /><LoadingState /></>);

  const draf = ruj.status === "draft";
  const laporanTerlampir = Boolean(lampiranId) || observasi.trim().length >= 10;

  return (
    <>
      <PageHead
        title={`Berkas Rujukan — ${ruj.child_name}`}
        subtitle={`Status: ${ruj.status === "draft" ? "Draf" : ruj.status === "siap_kirim" ? "Siap Kirim" : "Terkirim"}`}
        action={<Link className="btn secondary" href="/skrining">&larr; Skrining &amp; Rujukan</Link>}
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Isi Berkas (Draf)</h2>
        <div className="field"><label htmlFor="rj_pemicu">Pemicu rujukan *</label>
          <textarea id="rj_pemicu" rows={2} value={pemicu} disabled={!draf} onChange={(e) => setPemicu(e.target.value)} /></div>
        <div className="field"><label htmlFor="rj_lampiran">Lampiran: Laporan Hasil Skrining final anak ini</label>
          <select id="rj_lampiran" value={lampiranId} disabled={!draf} onChange={(e) => setLampiranId(e.target.value)}>
            <option value="">— Belum dipasang —</option>
            {tersedia.map((l) => (
              <option key={l.id} value={l.id}>Laporan Final — {LABEL_JENIS_SKRINING[l.jenis] || l.jenis}</option>
            ))}
          </select>
          <small className="muted">Laporan final terpasang utuh sebagai lampiran Laporan Observasi — termasuk Peta Perkembangan Anak — tanpa menyalin isinya.</small>
        </div>
        <div className="field"><label htmlFor="rj_obs">Laporan observasi (teks, bila tidak memakai lampiran laporan)</label>
          <textarea id="rj_obs" rows={4} value={observasi} disabled={!draf} onChange={(e) => setObservasi(e.target.value)} /></div>
        <label>
          <input type="checkbox" checked={setuju} disabled={!draf} onChange={(e) => setSetuju(e.target.checked)} />{" "}
          Persetujuan tertulis orang tua tercatat
          {ruj.persetujuan_ortu_at ? <span className="muted"> — sejak {tanggalPanjang(String(ruj.persetujuan_ortu_at))}</span> : null}
        </label>
        {draf ? (
          <div style={{ marginTop: 10 }}>
            <button className="btn secondary" type="button" disabled={busy}
              onClick={() => void patch({ pemicu, laporan_observasi: observasi, laporan_skrining_id: lampiranId || null, persetujuan_ortu_tercatat: setuju }, "Draf berkas tersimpan.")}>
              Simpan Draf
            </button>
          </div>
        ) : null}
        <dl style={{ marginTop: 14 }}>
          <dt className="muted">Tujuan rujukan</dt>
          <dd>{ruj.tujuan ? <strong>{String(ruj.tujuan)}</strong> : <span className="muted">(selalu kosong pada draf — terisi saat berkas diterbitkan)</span>}</dd>
          {ruj.diterbitkan_at ? (<><dt className="muted">Diterbitkan</dt><dd>{tanggalPanjang(String(ruj.diterbitkan_at))}</dd></>) : null}
          {ruj.dikirim_at ? (<><dt className="muted">Terkirim</dt><dd>{tanggalPanjang(String(ruj.dikirim_at))} via {String(ruj.saluran || "")}</dd></>) : null}
        </dl>
      </div>

      {draf ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Terbitkan Berkas (Founder)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Persetujuan akhir berkas rujukan adalah hak khusus founder. Status siap kirim hanya tercapai bila
            laporan observasi lengkap terlampir dan persetujuan tertulis orang tua tercatat — keduanya ditegakkan server.
          </p>
          <ul className="muted" style={{ marginTop: 0 }}>
            <li>{laporanTerlampir ? "✓" : "○"} Laporan observasi lengkap terlampir</li>
            <li>{setuju ? "✓" : "○"} Persetujuan tertulis orang tua tercatat</li>
          </ul>
          <div className="field"><label htmlFor="rj_tujuan">Tujuan rujukan (ketik, atau pilih cepat) *</label>
            <input id="rj_tujuan" value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Diketik saat berkas diterbitkan, sesuai kesepakatan bersama orang tua" /></div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {TUJUAN_CEPAT_RUJUKAN.map((t) => (
              <button key={t} className="btn small secondary" type="button" onClick={() => setTujuan(t)}>{t}</button>
            ))}
          </div>
          <button className="btn" type="button" disabled={busy} style={{ marginTop: 12 }}
            onClick={() => void patch({ aksi: "terbitkan", tujuan }, "Berkas diterbitkan — status Siap Kirim, tujuan terisi.")}>
            Terbitkan (Siap Kirim)
          </button>
        </div>
      ) : null}

      {ruj.status === "siap_kirim" ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pengiriman</h2>
          <div className="row" style={{ gap: 8 }}>
            <select aria-label="Saluran kirim" value={saluran} onChange={(e) => setSaluran(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="langsung">Diserahkan Langsung</option>
            </select>
            <button className="btn" type="button" disabled={busy}
              onClick={() => void patch({ aksi: "kirim", saluran }, "Pengiriman berkas tercatat.")}>
              Catat Terkirim
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
