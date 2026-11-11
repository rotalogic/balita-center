"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePublik } from "@/components/publik-data";
import { JENIS_SKRINING } from "@/lib/skrining";
import { NAMA_LAYANAN } from "@/lib/minat";
import { WA_LINK } from "@/lib/publik";

// Kalimat resmi untuk pilihan konsultasi: tanpa kolom tanggal, dan lembaga
// yang menghubungi orang tua untuk mengatur jadwalnya.
const KALIMAT_KONSULTASI =
  "Untuk pilihan konsultasi ini, lembaga akan menghubungi orang tua untuk mengatur jadwal konsultasi.";

const rupiah = (v: number) => `Rp ${Number(v || 0).toLocaleString("id-ID")}`;

function Formulir() {
  const data = usePublik();
  const params = useSearchParams();
  const [pilihan, setPilihan] = useState("");
  const [f, setF] = useState({
    child_name: "", child_birth_date: "", parent_name: "", wa_number: "", email: "",
    tanggal: "", tarif_jenis: "reguler", kebutuhan_khusus: "", alergi_jenis: "",
  });
  const [alergiTidakAda, setAlergiTidakAda] = useState(false);
  const [setujuDokumentasi, setSetujuDokumentasi] = useState(false);
  const [setujuBayar, setSetujuBayar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<{ anak: string; pilihan: string; tanggal: string | null; konsultasi: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const ev = params.get("event");
    const ly = params.get("layanan");
    if (ev) setPilihan(`event:${ev}`);
    else if (ly) setPilihan(ly);
  }, [params]);

  const konsultasi = pilihan === "konsultasi" || pilihan === "minat_bakat" || pilihan.startsWith("skrining:");
  const edisiPilihan = pilihan.startsWith("event:") ? data?.event.find((e) => e.id === pilihan.slice(6)) : undefined;
  const berbayar = Boolean(edisiPilihan && (edisiPilihan.htm_reguler || edisiPilihan.htm_early_bird));

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/publik/daftar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f, pilihan, alergi_tidak_ada: alergiTidakAda,
        setuju_dokumentasi: setujuDokumentasi, setuju_ketentuan_bayar: setujuBayar,
        situs_web: "",
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return; }
    setSukses(d.ringkasan);
  }

  if (sukses) {
    return (
      <div className="pb-ok" role="status">
        <h2 style={{ marginTop: 0 }}>Pendaftaran Terkirim</h2>
        <p>
          Terima kasih — pendaftaran untuk <strong>{sukses.anak}</strong> pada pilihan{" "}
          <strong>{sukses.pilihan}</strong>{sukses.tanggal ? <> untuk tanggal <strong>{sukses.tanggal}</strong></> : null}{" "}
          sudah masuk ke sistem lembaga dan akan ditindaklanjuti admin kami.
        </p>
        {sukses.konsultasi ? <p>{KALIMAT_KONSULTASI}</p> : null}
        <p>
          Bila Ayah/Bunda ingin meneruskan ringkasan ini secara manual, silakan tekan tombol WhatsApp Admin
          (tautan polos, tanpa pesan terisi otomatis):
        </p>
        <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">WhatsApp Admin</a>
      </div>
    );
  }

  return (
    <form onSubmit={kirim}>
      {error ? <p className="pb-err" role="alert">{error}</p> : null}
      <div className="pb-form2">
        <div className="pb-field"><label htmlFor="bg_anak">Nama anak *</label>
          <input id="bg_anak" required value={f.child_name} onChange={(e) => set("child_name", e.target.value)} /></div>
        <div className="pb-field"><label htmlFor="bg_lahir">Tanggal lahir anak</label>
          <input id="bg_lahir" type="date" value={f.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} /></div>
        <div className="pb-field"><label htmlFor="bg_ortu">Nama orang tua *</label>
          <input id="bg_ortu" required value={f.parent_name} onChange={(e) => set("parent_name", e.target.value)} /></div>
        <div className="pb-field"><label htmlFor="bg_wa">Nomor WhatsApp *</label>
          <input id="bg_wa" required value={f.wa_number} onChange={(e) => set("wa_number", e.target.value)} placeholder="62812…" /></div>
        <div className="pb-field"><label htmlFor="bg_email">Email orang tua</label>
          <input id="bg_email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="pb-field"><label htmlFor="bg_pilihan">Pilihan kegiatan / layanan *</label>
          <select id="bg_pilihan" required value={pilihan} onChange={(e) => setPilihan(e.target.value)}>
            <option value="">— Pilih —</option>
            <optgroup label="Kelas & Program">
              <option value="zkc">Program Ziel Kids Club (Reguler / Movement / Calistung)</option>
              <option value="sam">Program Sekolah Alam Montessori (NIDO / CASA / Discovery)</option>
            </optgroup>
            <optgroup label="Event">
              {(data?.event || []).filter((e) => e.status === "buka").map((e) => (
                <option key={e.id} value={`event:${e.id}`}>{e.nama}</option>
              ))}
            </optgroup>
            <optgroup label="Layanan Skrining">
              {JENIS_SKRINING.map(([k, nama]) => <option key={k} value={`skrining:${k}`}>{nama}</option>)}
            </optgroup>
            <optgroup label="Konsultasi">
              <option value="konsultasi">Konsultasi</option>
              <option value="minat_bakat">{NAMA_LAYANAN}</option>
            </optgroup>
          </select></div>
      </div>

      {konsultasi ? (
        <p style={{ color: "#57462f" }}>{KALIMAT_KONSULTASI}</p>
      ) : (
        <div className="pb-field"><label htmlFor="bg_tanggal">Tanggal kegiatan yang diinginkan *</label>
          <input id="bg_tanggal" type="date" required value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} /></div>
      )}

      {edisiPilihan ? (
        <div className="pb-field"><label htmlFor="bg_tarif">Jenis tarif</label>
          <select id="bg_tarif" value={f.tarif_jenis} onChange={(e) => set("tarif_jenis", e.target.value)}>
            {edisiPilihan.htm_reguler ? <option value="reguler">Reguler — {rupiah(edisiPilihan.htm_reguler)}</option> : null}
            {edisiPilihan.htm_early_bird ? <option value="early_bird">Early bird — {rupiah(edisiPilihan.htm_early_bird)}</option> : null}
          </select></div>
      ) : null}

      <div className="pb-form2">
        <div className="pb-field"><label htmlFor="bg_alergi">Alergi anak (isi bila ada)</label>
          <input id="bg_alergi" value={f.alergi_jenis} disabled={alergiTidakAda} onChange={(e) => set("alergi_jenis", e.target.value)} placeholder="mis. kacang, susu sapi" /></div>
        <div className="pb-field"><label htmlFor="bg_khusus">Kebutuhan khusus anak</label>
          <input id="bg_khusus" value={f.kebutuhan_khusus} onChange={(e) => set("kebutuhan_khusus", e.target.value)} /></div>
      </div>
      <p className="pb-cek">
        <input id="bg_tidak_alergi" type="checkbox" checked={alergiTidakAda} onChange={(e) => setAlergiTidakAda(e.target.checked)} />
        <label htmlFor="bg_tidak_alergi">Tidak Ada Alergi yang Diketahui (wajib dipilih bila kolom alergi dikosongkan)</label>
      </p>
      <p className="pb-cek">
        <input id="bg_dokumentasi" type="checkbox" checked={setujuDokumentasi} onChange={(e) => setSetujuDokumentasi(e.target.checked)} />
        <label htmlFor="bg_dokumentasi">Kami menyetujui dokumentasi foto kegiatan anak kami oleh lembaga.</label>
      </p>
      {berbayar ? (
        <p className="pb-cek">
          <input id="bg_bayar" type="checkbox" checked={setujuBayar} onChange={(e) => setSetujuBayar(e.target.checked)} />
          <label htmlFor="bg_bayar">Kami memahami kegiatan ini berbayar dan pembayaran yang sudah dilakukan tidak dapat dibatalkan dan tidak dapat dikembalikan.</label>
        </p>
      ) : null}
      <button className="pb-btn" type="submit" disabled={busy || !pilihan} style={{ marginTop: 10 }}>
        {busy ? "Mengirim…" : "Kirim Pendaftaran"}
      </button>
      <p style={{ color: "#57462f", fontSize: 13.5 }}>
        Kiriman formulir ini masuk langsung ke sistem Penerimaan lembaga — bukan menjadi pesan lepas di luar sistem.
      </p>
    </form>
  );
}

export default function BergabungForm() {
  return (
    <Suspense fallback={<p>Sedang memuat formulir…</p>}>
      <Formulir />
    </Suspense>
  );
}
