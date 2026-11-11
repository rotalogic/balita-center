"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { SKALA_ZKC } from "@/lib/skala";
import {
  LABEL_JENIS_SKRINING, PILIHAN_TINDAK_LANJUT, STATUS_SKRINING, TAHAP_SKRINING,
  type BarisHasil, type BarisIndikasi, type PetaPerkembangan,
} from "@/lib/skrining";

type Skr = Record<string, unknown> & { id: string; status: string; child_name: string };
type Lap = Record<string, unknown> & { id: string; status: string } | null;

const HASIL_KATA = Object.values(SKALA_ZKC);
const PETA_KOSONG: PetaPerkembangan = {
  kekuatan: { teks: "", bukti: "" }, berkembang: { teks: "", bukti: "" }, dukungan: { teks: "", bukti: "" },
};

export default function SkriningWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [skr, setSkr] = useState<Skr | null>(null);
  const [laporan, setLaporan] = useState<Lap>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [t1, setT1] = useState({ persetujuan_ortu: false, persetujuan_nama: "", anamnesis: "", konteks_keluarga: "" });
  const [t2, setT2] = useState({ sosial_emosi: "", kelekatan: "", regulasi: "" });
  const [t3rows, setT3rows] = useState<BarisHasil[]>([]);
  const [t3catatan, setT3catatan] = useState("");
  const [t4rows, setT4rows] = useState<BarisIndikasi[]>([]);
  const [t4catatan, setT4catatan] = useState("");
  const [ringkasan, setRingkasan] = useState("");
  const [peta, setPeta] = useState<PetaPerkembangan>(PETA_KOSONG);
  const [kesimpulan, setKesimpulan] = useState("");
  const [rekomendasi, setRekomendasi] = useState("");
  const [rekPilihan, setRekPilihan] = useState("");
  const [rekAlasan, setRekAlasan] = useState("");
  const [rekBank, setRekBank] = useState("");
  const [penjelasan, setPenjelasan] = useState({ tanggal: "", oleh: "" });
  const [saluran, setSaluran] = useState("whatsapp");

  const load = useCallback(() => {
    fetch(`/api/skrining/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        const s = d.skrining as Skr;
        setSkr(s);
        setLaporan(d.laporan as Lap);
        const th = (s.tahap || {}) as Record<string, Record<string, unknown>>;
        if (th.tahap1) setT1({
          persetujuan_ortu: Boolean(s.persetujuan_ortu_at), persetujuan_nama: String(th.tahap1.persetujuan_nama || ""),
          anamnesis: String(th.tahap1.anamnesis || ""), konteks_keluarga: String(th.tahap1.konteks_keluarga || ""),
        });
        if (th.tahap2) setT2({
          sosial_emosi: String(th.tahap2.sosial_emosi || ""), kelekatan: String(th.tahap2.kelekatan || ""),
          regulasi: String(th.tahap2.regulasi || ""),
        });
        if (th.tahap3) { setT3rows((th.tahap3.rows as BarisHasil[]) || []); setT3catatan(String(th.tahap3.catatan || "")); }
        if (th.tahap4) { setT4rows((th.tahap4.rows as BarisIndikasi[]) || []); setT4catatan(String(th.tahap4.catatan || "")); }
        const l = d.laporan as Lap;
        if (l) {
          setRingkasan(String(l.ringkasan || ""));
          setPeta((l.peta as PetaPerkembangan) || PETA_KOSONG);
          setKesimpulan(String(l.kesimpulan || ""));
          setRekomendasi(String(l.rekomendasi || ""));
          setRekPilihan(String(l.rekomendasi_pilihan || ""));
          setRekAlasan(String(l.rekomendasi_alasan || ""));
          setRekBank(String(l.rekomendasi_bank || ""));
          setPenjelasan({ tanggal: String(l.penjelasan_tanggal || "").slice(0, 10), oleh: String(l.penjelasan_oleh || "") });
        }
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, pesan: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/skrining/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return null; }
    setInfo(pesan);
    load();
    return d;
  }

  if (error && !skr) return (<><PageHead title="Ruang Kerja Skrining" /><ErrorState message={error} /></>);
  if (!skr) return (<><PageHead title="Ruang Kerja Skrining" /><LoadingState /></>);

  const th = (skr.tahap || {}) as Record<string, unknown>;
  const selesaiTahap = (n: number) => Boolean(th[`tahap${n}`]);
  const terkunci = skr.status === "selesai";
  const lapFinal = laporan?.status === "final";

  return (
    <>
      <PageHead
        title={`Skrining — ${skr.child_name}`}
        subtitle={`${LABEL_JENIS_SKRINING[String(skr.jenis)] || ""} · Status: ${STATUS_SKRINING[skr.status] || skr.status}`}
        action={<Link className="btn secondary" href="/skrining">&larr; Semua Skrining</Link>}
      />
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <p className="muted">
        Batas non-klinis: skrining adalah pemetaan dan deteksi dini — bukan diagnosis, bukan terapi, bukan janji hasil.
        Hasil dibaca sebagai <strong>Peta Perkembangan Anak</strong>: posisi perkembangan anak saat pemeriksaan dilakukan.
      </p>

      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {TAHAP_SKRINING.map(([n, nama]) => (
            <span key={n} className={`badge ${n === 5 ? (lapFinal ? "ok" : "warn") : selesaiTahap(n) ? "ok" : "warn"}`}>
              {n === 5 ? (lapFinal ? "✓ " : "") : selesaiTahap(n) ? "✓ " : ""}Tahap {n} · {nama}
            </span>
          ))}
        </div>
        {skr.status === "pendaftaran" ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Status belum dapat berubah menjadi Skrining Berjalan sebelum persetujuan tertulis orang tua tercatat
              dan isian Tahap 1 tersimpan — gerbang ini ditegakkan server.
            </p>
            <button className="btn" type="button" disabled={busy}
              onClick={() => void patch({ aksi: "mulai" }, "Pemeriksaan berstatus Skrining Berjalan.")}>
              Mulai Skrining (Berjalan)
            </button>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tahap 1 · Penerimaan &amp; Wawancara Awal</h2>
        <label>
          <input type="checkbox" checked={t1.persetujuan_ortu} disabled={terkunci}
            onChange={(e) => setT1({ ...t1, persetujuan_ortu: e.target.checked })} />{" "}
          Persetujuan tertulis orang tua tercatat
        </label>
        <div className="grid-form" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="t1_nama">Nama pemberi persetujuan</label>
            <input id="t1_nama" value={t1.persetujuan_nama} disabled={terkunci} onChange={(e) => setT1({ ...t1, persetujuan_nama: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="t1_anam">Anamnesis (perangkat wawancara lembaga)</label>
          <textarea id="t1_anam" rows={3} value={t1.anamnesis} disabled={terkunci} onChange={(e) => setT1({ ...t1, anamnesis: e.target.value })} /></div>
        <div className="field"><label htmlFor="t1_konteks">Konteks keluarga</label>
          <textarea id="t1_konteks" rows={3} value={t1.konteks_keluarga} disabled={terkunci} onChange={(e) => setT1({ ...t1, konteks_keluarga: e.target.value })} /></div>
        <button className="btn secondary" type="button" disabled={busy || terkunci} style={{ marginTop: 8 }}
          onClick={() => void patch({ aksi: "tahap", n: 1, data: t1 }, "Tahap 1 tersimpan.")}>Simpan Tahap 1</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tahap 2 · Kejiwaan &amp; Sosial Emosi</h2>
        <p className="muted" style={{ marginTop: 0 }}>Selalu dibaca lebih dulu — keadaan sosial emosi dan regulasi mewarnai performa anak pada seluruh tugas berikutnya.</p>
        <div className="field"><label htmlFor="t2_se">Pemetaan sosial emosi</label>
          <textarea id="t2_se" rows={2} value={t2.sosial_emosi} disabled={terkunci} onChange={(e) => setT2({ ...t2, sosial_emosi: e.target.value })} /></div>
        <div className="field"><label htmlFor="t2_kel">Kelekatan</label>
          <textarea id="t2_kel" rows={2} value={t2.kelekatan} disabled={terkunci} onChange={(e) => setT2({ ...t2, kelekatan: e.target.value })} /></div>
        <div className="field"><label htmlFor="t2_reg">Regulasi anak</label>
          <textarea id="t2_reg" rows={2} value={t2.regulasi} disabled={terkunci} onChange={(e) => setT2({ ...t2, regulasi: e.target.value })} /></div>
        <button className="btn secondary" type="button" disabled={busy || terkunci || !selesaiTahap(1)} style={{ marginTop: 8 }}
          onClick={() => void patch({ aksi: "tahap", n: 2, data: t2 }, "Tahap 2 tersimpan.")}>Simpan Tahap 2</button>
        {!selesaiTahap(1) ? <span className="muted" style={{ marginLeft: 8 }}>Simpan Tahap 1 dulu.</span> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tahap 3 · Domain Sesuai Tujuan Skrining</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Catat nama domain dan indikator, hasil dalam kata, dan bukti perilaku yang teramati. Teks soal, bunyi tugas,
          dan kunci jawaban tidak pernah dicatat di sini dan tidak pernah masuk ke laporan.
        </p>
        <table>
          <thead><tr><th>Ranah / Domain</th><th>Indikator</th><th>Hasil Kata</th><th>Bukti Perilaku Teramati</th><th /></tr></thead>
          <tbody>
            {t3rows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.ranah} disabled={terkunci} onChange={(e) => setT3rows((p) => p.map((x, j) => (j === i ? { ...x, ranah: e.target.value } : x)))} placeholder="mis. Bahasa & Komunikasi" /></td>
                <td><input value={r.indikator} disabled={terkunci} onChange={(e) => setT3rows((p) => p.map((x, j) => (j === i ? { ...x, indikator: e.target.value } : x)))} /></td>
                <td>
                  <select value={r.hasil} disabled={terkunci} onChange={(e) => setT3rows((p) => p.map((x, j) => (j === i ? { ...x, hasil: e.target.value } : x)))}>
                    {HASIL_KATA.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
                <td><input value={r.bukti} disabled={terkunci} onChange={(e) => setT3rows((p) => p.map((x, j) => (j === i ? { ...x, bukti: e.target.value } : x)))} /></td>
                <td><button className="btn small danger" type="button" disabled={terkunci} onClick={() => setT3rows((p) => p.filter((_, j) => j !== i))}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="t3_cat">Catatan pemeriksa tahap ini</label>
          <textarea id="t3_cat" rows={2} value={t3catatan} disabled={terkunci} onChange={(e) => setT3catatan(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn secondary" type="button" disabled={terkunci} onClick={() => setT3rows((p) => [...p, { ranah: "", indikator: "", hasil: HASIL_KATA[1], bukti: "" }])}>+ Baris Domain</button>
          <button className="btn" type="button" disabled={busy || terkunci || !selesaiTahap(2)}
            onClick={() => void patch({ aksi: "tahap", n: 3, data: { rows: t3rows, catatan: t3catatan } }, "Tahap 3 tersimpan.")}>Simpan Tahap 3</button>
          {!selesaiTahap(2) ? <span className="muted">Simpan Tahap 2 dulu.</span> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tahap 4 · Pemetaan Indikasi</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Baca kelompok indikasi Panduan Red Flag lembaga dari seluruh hasil tahap sebelumnya. Bahasa yang dipakai
          adalah bahasa indikasi dan pemetaan — bukan diagnosis.
        </p>
        <table>
          <thead><tr><th>Kelompok Indikasi</th><th>Indikator Teramati</th><th>Ambang Rujuk Tercapai</th><th>Catatan</th><th /></tr></thead>
          <tbody>
            {t4rows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.kelompok} disabled={terkunci} onChange={(e) => setT4rows((p) => p.map((x, j) => (j === i ? { ...x, kelompok: e.target.value } : x)))} placeholder="nama kelompok pada panduan lembaga" /></td>
                <td><input value={r.indikator} disabled={terkunci} onChange={(e) => setT4rows((p) => p.map((x, j) => (j === i ? { ...x, indikator: e.target.value } : x)))} /></td>
                <td><input type="checkbox" checked={r.ambang} disabled={terkunci} onChange={(e) => setT4rows((p) => p.map((x, j) => (j === i ? { ...x, ambang: e.target.checked } : x)))} /></td>
                <td><input value={r.catatan} disabled={terkunci} onChange={(e) => setT4rows((p) => p.map((x, j) => (j === i ? { ...x, catatan: e.target.value } : x)))} /></td>
                <td><button className="btn small danger" type="button" disabled={terkunci} onClick={() => setT4rows((p) => p.filter((_, j) => j !== i))}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="t4_cat">Catatan pengamatan lanjutan (bila diperlukan)</label>
          <textarea id="t4_cat" rows={2} value={t4catatan} disabled={terkunci} onChange={(e) => setT4catatan(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn secondary" type="button" disabled={terkunci} onClick={() => setT4rows((p) => [...p, { kelompok: "", indikator: "", ambang: false, catatan: "" }])}>+ Baris Indikasi</button>
          <button className="btn" type="button" disabled={busy || terkunci || !selesaiTahap(3)}
            onClick={() => void patch({ aksi: "tahap", n: 4, data: { rows: t4rows, catatan: t4catatan } }, "Tahap 4 tersimpan.")}>Simpan Tahap 4</button>
          {!selesaiTahap(3) ? <span className="muted">Simpan Tahap 3 dulu.</span> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tahap 5 · Sintesis &amp; Laporan Hasil Skrining</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Draf laporan hanya lahir dari fakta yang diisikan pada formulir tahap — sistem tidak menentukan nilai,
          status, indikasi, atau kesimpulan di luar isian pemeriksa. Draf wajib ditinjau dan disetujui pemilik.
        </p>
        {!laporan ? (
          <button className="btn" type="button" disabled={busy || !selesaiTahap(3)}
            onClick={() => void patch({ aksi: "susun_draf" }, "Draf Laporan Hasil Skrining tersusun dari isian tahap.")}>
            Susun Draf Laporan dari Isian Tahap
          </button>
        ) : (
          <>
            <h3>Tabel Hasil per Ranah / Domain</h3>
            {((laporan.tabel_hasil as BarisHasil[]) || []).length === 0 ? <p className="muted">Belum ada baris hasil.</p> : (
              <table>
                <thead><tr><th>Ranah</th><th>Indikator</th><th>Hasil</th><th>Bukti Teramati</th></tr></thead>
                <tbody>
                  {(laporan.tabel_hasil as BarisHasil[]).map((r, i) => (
                    <tr key={i}><td>{r.ranah}</td><td>{r.indikator}</td><td>{r.hasil}</td><td>{r.bukti}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="lp_ring">Ringkasan gambaran anak (bahasa sehari-hari)</label>
              <textarea id="lp_ring" rows={3} value={ringkasan} disabled={lapFinal} onChange={(e) => setRingkasan(e.target.value)} /></div>
            <h3>Peta Perkembangan Anak — tiga bacaan, setiap bacaan wajib berbukti teramati</h3>
            {(Object.keys(PETA_KOSONG) as Array<keyof PetaPerkembangan>).map((k) => (
              <div className="grid-form" key={k}>
                <div className="field">
                  <label htmlFor={`peta_${k}`}>{k === "kekuatan" ? "Kekuatan yang Menonjol" : k === "berkembang" ? "Kemampuan yang Sedang Berkembang" : "Area yang Memerlukan Dukungan"}</label>
                  <textarea id={`peta_${k}`} rows={2} value={peta[k].teks} disabled={lapFinal}
                    onChange={(e) => setPeta((p) => ({ ...p, [k]: { ...p[k], teks: e.target.value } }))} />
                </div>
                <div className="field">
                  <label htmlFor={`bukti_${k}`}>Bukti (indikator/tugas yang benar-benar teramati)</label>
                  <textarea id={`bukti_${k}`} rows={2} value={peta[k].bukti} disabled={lapFinal}
                    onChange={(e) => setPeta((p) => ({ ...p, [k]: { ...p[k], bukti: e.target.value } }))} />
                </div>
              </div>
            ))}
            <div className="field"><label htmlFor="lp_kes">Kesimpulan (bahasa pemetaan &amp; deteksi dini — tidak pernah berbunyi diagnosis)</label>
              <textarea id="lp_kes" rows={3} value={kesimpulan} disabled={lapFinal} onChange={(e) => setKesimpulan(e.target.value)} /></div>
            <div className="grid-form">
              <div className="field"><label htmlFor="lp_pil">Pilihan tindak lanjut</label>
                <select id="lp_pil" value={rekPilihan} disabled={lapFinal} onChange={(e) => setRekPilihan(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {PILIHAN_TINDAK_LANJUT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
              <div className="field"><label htmlFor="lp_bank">Bank sesi tujuan + contoh sesi awal (bila pendampingan/observasi)</label>
                <input id="lp_bank" value={rekBank} disabled={lapFinal} onChange={(e) => setRekBank(e.target.value)} placeholder="mis. Pendampingan Bahasa dan Komunikasi — sesi awal: …" /></div>
            </div>
            <div className="field"><label htmlFor="lp_rek">Rekomendasi tindak lanjut (dapat dijalankan keluarga di rumah)</label>
              <textarea id="lp_rek" rows={3} value={rekomendasi} disabled={lapFinal} onChange={(e) => setRekomendasi(e.target.value)} /></div>
            <div className="field"><label htmlFor="lp_alasan">Alasan pilihan tindak lanjut (dicatat pemeriksa)</label>
              <textarea id="lp_alasan" rows={2} value={rekAlasan} disabled={lapFinal} onChange={(e) => setRekAlasan(e.target.value)} /></div>
            {!lapFinal ? (
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn secondary" type="button" disabled={busy}
                  onClick={() => void patch({ aksi: "simpan_laporan", ringkasan, peta, kesimpulan, rekomendasi, rekomendasi_pilihan: rekPilihan || null, rekomendasi_alasan: rekAlasan, rekomendasi_bank: rekBank }, "Laporan tersimpan sebagai draf.")}>
                  Simpan Draf Laporan
                </button>
                <button className="btn" type="button" disabled={busy}
                  onClick={() => void patch({ aksi: "finalkan" }, "Laporan Hasil Skrining FINAL — disetujui pemilik.")}>
                  Setujui &amp; Finalkan (Pemilik)
                </button>
              </div>
            ) : (
              <>
                <p style={{ marginTop: 12 }}>
                  <span className="badge ok">✓ Laporan Final</span>{" "}
                  <span className="muted">disetujui {laporan.disetujui_at ? tanggalPanjang(String(laporan.disetujui_at)) : ""}</span>
                </p>
                <div className="grid-form">
                  <div className="field"><label htmlFor="pj_tgl">Tanggal sesi penjelasan hasil *</label>
                    <input id="pj_tgl" type="date" value={penjelasan.tanggal} onChange={(e) => setPenjelasan({ ...penjelasan, tanggal: e.target.value })} /></div>
                  <div className="field"><label htmlFor="pj_oleh">Pemberi penjelasan *</label>
                    <input id="pj_oleh" value={penjelasan.oleh} onChange={(e) => setPenjelasan({ ...penjelasan, oleh: e.target.value })} /></div>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn secondary" type="button" disabled={busy}
                    onClick={() => void patch({ aksi: "penjelasan", tanggal: penjelasan.tanggal, oleh: penjelasan.oleh }, "Sesi penjelasan hasil tercatat.")}>
                    Catat Sesi Penjelasan
                  </button>
                  <select aria-label="Saluran kirim laporan" value={saluran} onChange={(e) => setSaluran(e.target.value)}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                  <button className="btn secondary" type="button" disabled={busy}
                    onClick={() => void patch({ aksi: "kirim_laporan", saluran }, "Pengiriman laporan tercatat.")}>
                    {laporan.dikirim_at ? "✓ Laporan Terkirim — Catat Ulang" : "Catat Laporan Terkirim"}
                  </button>
                  {skr.status !== "selesai" ? (
                    <button className="btn" type="button" disabled={busy}
                      onClick={() => void patch({ aksi: "selesaikan" }, "Pemeriksaan skrining selesai.")}>
                      Selesaikan Pemeriksaan
                    </button>
                  ) : <span className="badge ok">✓ Pemeriksaan Selesai</span>}
                  {(rekPilihan === "rujukan" || rekPilihan === "keduanya") ? (
                    <button className="btn secondary" type="button" disabled={busy}
                      onClick={async () => {
                        const res = await fetch("/api/rujukan", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            child_id: skr.child_id || undefined, child_name: skr.child_name,
                            skrining_id: skr.id, laporan_skrining_id: laporan.id,
                            pemicu: `Hasil ${LABEL_JENIS_SKRINING[String(skr.jenis)] || "skrining"} menunjukkan indikasi dengan ambang rujuk tercapai. ${rekAlasan}`.trim(),
                          }),
                        });
                        const d = await res.json();
                        if (d.ok) router.push(`/skrining/rujukan/${d.id}`);
                        else setError(d.error);
                      }}>
                      Buat Berkas Rujukan dari Laporan Ini
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
