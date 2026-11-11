"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { SKALA_KATA_4 } from "@/lib/skala";
import {
  KEKUATAN_LENGKAP, LANGKAH_KONSULTASI, PEMROSESAN, PLAKAT_NOTICEABILITY, RANAH_MENONJOL, SOP_SESI, umurBulanDariLahir,
} from "@/lib/minat";

type Kon = Record<string, unknown> & { id: string; status: string; child_name: string; laporan_status: string };
type NilaiKekuatan = Record<string, { nilai: string; catatan: string }>;

export default function KonsultasiWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [kon, setKon] = useState<Kon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [l1, setL1] = useState({ konteks_keluarga: "", riwayat_aktivitas: "", gambaran_minat: "" });
  const [obs, setObs] = useState({ observasi_kekuatan: "", wawancara_anak: "", wawancara_ortu: "", telaah_riwayat: "" });
  const [kekuatan, setKekuatan] = useState<NilaiKekuatan>({});
  const [pemrosesan, setPemrosesan] = useState({ dominan: "", pendukung: "" });
  const [caraBelajar, setCaraBelajar] = useState({ dominan: "", pendukung: "" });
  const [temperamen, setTemperamen] = useState("");
  const [ranah, setRanah] = useState<string[]>([]);
  const [tanda, setTanda] = useState("");
  const [sesi, setSesi] = useState({ tanggal: "", oleh: "" });
  const [keluaran, setKeluaran] = useState({ kekuatan_menonjol: "", bidang_minat: "", kecenderungan_arah: "", rekomendasi: "" });
  const [saluran, setSaluran] = useState("whatsapp");

  const load = useCallback(() => {
    fetch(`/api/konsultasi/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        const k = d.konsultasi as Kon;
        setKon(k);
        const lk = (k.langkah || {}) as Record<string, Record<string, unknown>>;
        if (lk.langkah1) setL1({
          konteks_keluarga: String(lk.langkah1.konteks_keluarga || ""),
          riwayat_aktivitas: String(lk.langkah1.riwayat_aktivitas || ""),
          gambaran_minat: String(lk.langkah1.gambaran_minat || ""),
        });
        if (lk.langkah2) {
          setObs({
            observasi_kekuatan: String(lk.langkah2.observasi_kekuatan || ""),
            wawancara_anak: String(lk.langkah2.wawancara_anak || ""),
            wawancara_ortu: String(lk.langkah2.wawancara_ortu || ""),
            telaah_riwayat: String(lk.langkah2.telaah_riwayat || ""),
          });
          setKekuatan((lk.langkah2.kekuatan as NilaiKekuatan) || {});
          const ln = (lk.langkah2.lensa || {}) as Record<string, unknown>;
          setPemrosesan({ dominan: String((ln.pemrosesan as Record<string, string>)?.dominan || ""), pendukung: String((ln.pemrosesan as Record<string, string>)?.pendukung || "") });
          setCaraBelajar({ dominan: String((ln.cara_belajar as Record<string, string>)?.dominan || ""), pendukung: String((ln.cara_belajar as Record<string, string>)?.pendukung || "") });
          setTemperamen(String(ln.temperamen || ""));
          setRanah((ln.ranah_menonjol as string[]) || []);
        }
        setTanda(String(k.tanda_rujukan || ""));
        setSesi({ tanggal: String(k.sesi_tanggal || "").slice(0, 10), oleh: String(k.sesi_oleh || "") });
        setKeluaran({
          kekuatan_menonjol: String(k.kekuatan_menonjol || ""), bidang_minat: String(k.bidang_minat || ""),
          kecenderungan_arah: String(k.kecenderungan_arah || ""), rekomendasi: String(k.rekomendasi || ""),
        });
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/konsultasi/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return null; }
    setInfo(pesan);
    load();
    return d;
  }

  if (error && !kon) return (<><PageHead title="Meja Kerja Konsultasi" /><ErrorState message={error} /></>);
  if (!kon) return (<><PageHead title="Meja Kerja Konsultasi" /><LoadingState /></>);

  const lk = (kon.langkah || {}) as Record<string, unknown>;
  const adaL1 = Boolean(lk.langkah1);
  const adaL2 = Boolean(lk.langkah2);
  const final = kon.laporan_status === "final";
  const terkunci = final;
  const umur = kon.child_birth_date ? umurBulanDariLahir(String(kon.child_birth_date)) : -1;
  const arahAwal = umur >= 48 && umur < 72;

  return (
    <>
      <PageHead
        title={`Konsultasi — ${kon.child_name}`}
        subtitle={`Klien Konsultasi · ${kon.child_birth_date ? tanggalPanjang(String(kon.child_birth_date)) : ""} · Status: ${kon.status === "selesai" ? "Selesai" : kon.status === "pemetaan" ? "Pemetaan Berjalan" : "Pendaftaran"}`}
        action={<Link className="btn secondary" href="/minat-bakat">&larr; Minat &amp; Bakat</Link>}
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <p className="muted">
        Bahasa layanan ini adalah bahasa konsultasi dan pemetaan non klinis — bukan asesmen psikologis, bukan diagnosis,
        dan bukan penentuan bakat yang tetap. {PLAKAT_NOTICEABILITY}
      </p>

      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {LANGKAH_KONSULTASI.map(([n, nama]) => {
            const ok = n === 1 ? adaL1 : n === 2 ? adaL2 : n === 3 ? Boolean(kon.sesi_tanggal) : final;
            return <span key={n} className={`badge ${ok ? "ok" : "warn"}`}>{ok ? "✓ " : ""}Langkah {n} · {nama}</span>;
          })}
        </div>
        <h3 style={{ marginBottom: 4 }}>SOP Sesi Konsultasi</h3>
        <ul className="muted" style={{ marginTop: 0 }}>
          {SOP_SESI.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Langkah 1 · Pendaftaran &amp; Wawancara Awal</h2>
        <div className="field"><label htmlFor="l1_konteks">Konteks keluarga</label>
          <textarea id="l1_konteks" rows={2} value={l1.konteks_keluarga} disabled={terkunci} onChange={(e) => setL1({ ...l1, konteks_keluarga: e.target.value })} /></div>
        <div className="field"><label htmlFor="l1_riwayat">Riwayat aktivitas anak</label>
          <textarea id="l1_riwayat" rows={2} value={l1.riwayat_aktivitas} disabled={terkunci} onChange={(e) => setL1({ ...l1, riwayat_aktivitas: e.target.value })} /></div>
        <div className="field"><label htmlFor="l1_minat">Gambaran minat yang selama ini terlihat di rumah dan di sekolah</label>
          <textarea id="l1_minat" rows={2} value={l1.gambaran_minat} disabled={terkunci} onChange={(e) => setL1({ ...l1, gambaran_minat: e.target.value })} /></div>
        <button className="btn secondary" type="button" disabled={busy || terkunci} style={{ marginTop: 8 }}
          onClick={() => void patch({ aksi: "langkah", n: 1, data: l1 }, "Langkah 1 tersimpan.")}>Simpan Langkah 1</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Langkah 2 · Pemetaan Kekuatan &amp; Minat</h2>
        <p className="muted" style={{ marginTop: 0 }}>Perangkat lembaga sendiri: observasi kekuatan, wawancara anak, wawancara orang tua, penelaahan riwayat aktivitas.</p>
        <div className="grid-form">
          <div className="field"><label htmlFor="l2_obs">Observasi kekuatan anak pada kegiatan yang dijalaninya</label>
            <textarea id="l2_obs" rows={3} value={obs.observasi_kekuatan} disabled={terkunci} onChange={(e) => setObs({ ...obs, observasi_kekuatan: e.target.value })} /></div>
          <div className="field"><label htmlFor="l2_anak">Penelusuran minat — wawancara dengan anak</label>
            <textarea id="l2_anak" rows={3} value={obs.wawancara_anak} disabled={terkunci} onChange={(e) => setObs({ ...obs, wawancara_anak: e.target.value })} /></div>
          <div className="field"><label htmlFor="l2_ortu">Penelusuran minat — wawancara dengan orang tua</label>
            <textarea id="l2_ortu" rows={3} value={obs.wawancara_ortu} disabled={terkunci} onChange={(e) => setObs({ ...obs, wawancara_ortu: e.target.value })} /></div>
          <div className="field"><label htmlFor="l2_riwayat">Penelaahan riwayat aktivitas dari waktu ke waktu</label>
            <textarea id="l2_riwayat" rows={3} value={obs.telaah_riwayat} disabled={terkunci} onChange={(e) => setObs({ ...obs, telaah_riwayat: e.target.value })} /></div>
        </div>

        <h3>Lensa Kekuatan — empat kekuatan yang terbaca</h3>
        {KEKUATAN_LENGKAP.map((k) => (
          <div className="grid-form" key={k.kunci} style={{ marginTop: 6 }}>
            <div className="field">
              <label htmlFor={`kk_${k.kunci}`}>{k.nama}</label>
              <select id={`kk_${k.kunci}`} value={kekuatan[k.kunci]?.nilai || SKALA_KATA_4[1]} disabled={terkunci}
                onChange={(e) => setKekuatan((p) => ({ ...p, [k.kunci]: { nilai: e.target.value, catatan: p[k.kunci]?.catatan || "" } }))}>
                {SKALA_KATA_4.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <small className="muted">{k.arahContoh}</small>
            </div>
            <div className="field">
              <label htmlFor={`kc_${k.kunci}`}>Bukti teramati</label>
              <input id={`kc_${k.kunci}`} value={kekuatan[k.kunci]?.catatan || ""} disabled={terkunci}
                onChange={(e) => setKekuatan((p) => ({ ...p, [k.kunci]: { nilai: p[k.kunci]?.nilai || SKALA_KATA_4[1], catatan: e.target.value } }))} />
            </div>
          </div>
        ))}

        <h3 style={{ marginTop: 16 }}>Empat Lensa Pemetaan</h3>
        <div className="grid-form">
          <div className="field"><label htmlFor="ln_pem_d">Kecenderungan Pemrosesan — dominan</label>
            <select id="ln_pem_d" value={pemrosesan.dominan} disabled={terkunci} onChange={(e) => setPemrosesan({ ...pemrosesan, dominan: e.target.value })}>
              <option value="">— Pilih —</option>{PEMROSESAN.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ln_pem_p">Kecenderungan Pemrosesan — pendukung</label>
            <select id="ln_pem_p" value={pemrosesan.pendukung} disabled={terkunci} onChange={(e) => setPemrosesan({ ...pemrosesan, pendukung: e.target.value })}>
              <option value="">— Pilih —</option>{PEMROSESAN.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ln_cb_d">Cara Belajar — jalur dominan (Profil Cara Belajar lembaga)</label>
            <input id="ln_cb_d" value={caraBelajar.dominan} disabled={terkunci} onChange={(e) => setCaraBelajar({ ...caraBelajar, dominan: e.target.value })} /></div>
          <div className="field"><label htmlFor="ln_cb_p">Cara Belajar — jalur pendukung</label>
            <input id="ln_cb_p" value={caraBelajar.pendukung} disabled={terkunci} onChange={(e) => setCaraBelajar({ ...caraBelajar, pendukung: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="ln_temp">Temperamen anak (ritme, intensitas reaksi, kemampuan beradaptasi, pendekatan terhadap hal baru)</label>
          <textarea id="ln_temp" rows={2} value={temperamen} disabled={terkunci} onChange={(e) => setTemperamen(e.target.value)} /></div>
        <div className="field"><span id="ln_ranah_label">Ranah yang menonjol (wilayah minat yang sedang tumbuh)</span>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 6 }} role="group" aria-labelledby="ln_ranah_label">
            {RANAH_MENONJOL.map((r) => (
              <label key={r}>
                <input type="checkbox" checked={ranah.includes(r)} disabled={terkunci}
                  onChange={(e) => setRanah((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))} /> {r}
              </label>
            ))}
          </div></div>

        <div className="field" style={{ marginTop: 10 }}><label htmlFor="l2_tanda">Bahan Indikasi untuk Rujukan (tanda krisis/bahaya yang terbaca — memicu rujukan segera, bukan protokol pemeriksaan)</label>
          <textarea id="l2_tanda" rows={2} value={tanda} disabled={terkunci} onChange={(e) => setTanda(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" disabled={busy || terkunci || !adaL1}
            onClick={() => void patch({
              aksi: "langkah", n: 2, tanda_rujukan: tanda || undefined,
              data: { ...obs, kekuatan, lensa: { pemrosesan, cara_belajar: caraBelajar, temperamen, ranah_menonjol: ranah } },
            }, "Langkah 2 (pemetaan) tersimpan.")}>
            Simpan Langkah 2
          </button>
          {!adaL1 ? <span className="muted">Simpan Langkah 1 dulu.</span> : null}
          {tanda.trim().length >= 5 ? (
            <button className="btn secondary" type="button" disabled={busy}
              onClick={async () => {
                const res = await fetch("/api/rujukan", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ child_id: kon.child_id || undefined, child_name: kon.child_name, pemicu: `Tanda dari Konsultasi dan Pemetaan Bakat Minat: ${tanda}` }),
                });
                const d = await res.json();
                if (d.ok) router.push(`/skrining/rujukan/${d.id}`);
                else setError(d.error);
              }}>
              Buat Berkas Rujukan Segera dari Tanda Ini
            </button>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Langkah 3 · Sesi Konsultasi Penjelasan Hasil</h2>
        <div className="grid-form">
          <div className="field"><label htmlFor="ss_tgl">Tanggal sesi bersama pendiri *</label>
            <input id="ss_tgl" type="date" value={sesi.tanggal} disabled={terkunci} onChange={(e) => setSesi({ ...sesi, tanggal: e.target.value })} /></div>
          <div className="field"><label htmlFor="ss_oleh">Pendiri penyampai hasil *</label>
            <input id="ss_oleh" value={sesi.oleh} disabled={terkunci} onChange={(e) => setSesi({ ...sesi, oleh: e.target.value })} /></div>
        </div>
        <button className="btn secondary" type="button" disabled={busy || terkunci || !adaL2} style={{ marginTop: 8 }}
          onClick={() => void patch({ aksi: "sesi", tanggal: sesi.tanggal, oleh: sesi.oleh }, "Sesi penjelasan hasil tercatat.")}>
          Catat Sesi Penjelasan
        </button>
        {!adaL2 ? <span className="muted" style={{ marginLeft: 8 }}>Sesudah Langkah 2 tersimpan.</span> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Langkah 4 · Peta Kekuatan dan Minat &amp; Rekomendasi Pengarahan</h2>
        <p className="muted" style={{ marginTop: 0 }}>Keluaran ini menjadi <strong>Laporan Konsultasi</strong> dan tersimpan pada berkas anak yang sama; hasilnya dapat mengalir menjadi bahan Rencana Dukungan guru bila anak mengikuti program lembaga.</p>
        <div className="field"><label htmlFor="kl_kuat">Peta Kekuatan dan Minat — kekuatan yang menonjol</label>
          <textarea id="kl_kuat" rows={3} value={keluaran.kekuatan_menonjol} disabled={terkunci} onChange={(e) => setKeluaran({ ...keluaran, kekuatan_menonjol: e.target.value })} /></div>
        <div className="field"><label htmlFor="kl_minat">Bidang minat yang terbaca (dari observasi, wawancara, dan riwayat aktivitas)</label>
          <textarea id="kl_minat" rows={2} value={keluaran.bidang_minat} disabled={terkunci} onChange={(e) => setKeluaran({ ...keluaran, bidang_minat: e.target.value })} /></div>
        <div className="field"><label htmlFor="kl_arah">Kecenderungan Arah (di dalam Rekomendasi Pengarahan)</label>
          <textarea id="kl_arah" rows={3} value={keluaran.kecenderungan_arah} disabled={terkunci} onChange={(e) => setKeluaran({ ...keluaran, kecenderungan_arah: e.target.value })} />
          <small className="muted">
            {arahAwal
              ? "Anak usia empat–lima tahun: kecenderungan arah dibaca sebagai kecenderungan awal yang masih sangat terbuka dan dapat berubah mengikuti tumbuhnya pengalaman anak."
              : "Dinyatakan sebagai kecenderungan yang teramati untuk dikembangkan — bukan ramalan profesi, bukan penentuan masa depan, bukan label tetap."}
          </small>
        </div>
        <div className="field"><label htmlFor="kl_rek">Rekomendasi Pengarahan (kegiatan &amp; ekstrakurikuler yang sesuai, program pendampingan lembaga bila relevan, arah persiapan jenjang berikutnya)</label>
          <textarea id="kl_rek" rows={3} value={keluaran.rekomendasi} disabled={terkunci} onChange={(e) => setKeluaran({ ...keluaran, rekomendasi: e.target.value })} /></div>
        {!final ? (
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn secondary" type="button" disabled={busy}
              onClick={() => void patch({
                aksi: "simpan_laporan", ...keluaran,
                lensa: { pemrosesan, cara_belajar: caraBelajar, temperamen, ranah_menonjol: ranah, kekuatan },
              }, "Keluaran tersimpan sebagai draf Laporan Konsultasi.")}>
              Simpan Draf Laporan Konsultasi
            </button>
            <button className="btn" type="button" disabled={busy}
              onClick={() => void patch({ aksi: "finalkan" }, "Laporan Konsultasi FINAL — konsultasi selesai.")}>
              Finalkan (Pendiri)
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <span className="badge ok">✓ Laporan Konsultasi Final</span>
            <span className="muted">disetujui {kon.disetujui_at ? tanggalPanjang(String(kon.disetujui_at)) : ""}</span>
            <select aria-label="Saluran kirim laporan" value={saluran} onChange={(e) => setSaluran(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <button className="btn secondary" type="button" disabled={busy}
              onClick={() => void patch({ aksi: "kirim", saluran }, "Pengiriman Laporan Konsultasi tercatat.")}>
              {kon.dikirim_at ? "✓ Terkirim — Catat Ulang" : "Catat Terkirim ke Keluarga"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
