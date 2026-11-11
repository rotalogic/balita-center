"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/chrome";
import { GUGUS_SAM_ANAK, BUTIR_SAM_ORTU, LABEL_ARAH, LABEL_HASIL_SAM } from "@/lib/filter-arah";
import KesepakatanAwal from "@/components/kesepakatan-awal";
import { SKALA_KATA_4 } from "@/lib/skala";
import { tanggalPanjang } from "@/lib/format";

type Program = { id: string; name: string };
type AccLog = {
  id: string; oleh_nama: string; oleh_peran: string | null; program: string | null;
  keputusan: string; catatan: string | null; created_at: string;
};
type FormData = Record<string, unknown> & {
  id?: string;
  child_name?: string; parent_name?: string; wa_number?: string;
  child_birth_date?: string | null; child_gender?: string | null;
  program_pilihan?: string | null; program_id?: string | null;
  tujuan_keluarga?: string | null;
  sinyal_dukungan_konsisten?: boolean; sinyal_catatan?: string | null;
  observasi_awal?: Record<string, unknown>;
  riwayat_awal?: Record<string, unknown>;
  filter_sam_anak?: Record<string, unknown> | null;
  filter_sam_ortu?: number[] | null;
  arah_rekomendasi?: string | null; arah_keyakinan?: string | null;
  arah_alasan?: string | null; arah_berbeda?: boolean;
  sam_hasil?: string | null; sam_alasan?: string | null;
  acc_status?: string; acc_nama?: string | null; acc_at?: string | null; acc_catatan?: string | null;
  discovery_status?: string | null; discovery_catatan?: string | null;
  kesepakatan_awal?: boolean; kesepakatan_awal_at?: string | null;
};

const RIWAYAT_FIELD: Array<[string, string, string]> = [
  ["kehamilan", "Riwayat kehamilan", "Kondisi kehamilan dan hal yang perlu diketahui guru"],
  ["persalinan", "Riwayat persalinan", "Cara lahir (normal / operasi / bantuan alat) dan keadaan saat lahir"],
  ["berat_lahir", "Berat lahir", "Berat lahir dalam gram, bila diketahui"],
  ["menyusu_makan", "Riwayat menyusu & makan awal", "ASI / susu pendamping, awal MPASI, pola makan awal"],
  ["pengasuhan", "Pola pengasuhan & pengasuh utama", "Siapa pengasuh utama anak sehari-hari"],
  ["pekerjaan_ortu", "Pekerjaan & waktu orang tua", "Pekerjaan ayah dan ibu beserta pola waktunya"],
  ["alergi", "Alergi", "Jenis alergi, pemicu, dan reaksi yang biasa muncul"],
  ["kesehatan", "Kondisi kesehatan", "Kondisi kesehatan anak saat ini"],
  ["riwayat_terapi", "Riwayat pemeriksaan / terapi", "Pemeriksaan atau terapi yang pernah / sedang dijalani"],
];

function umurTeks(tanggal: string): string {
  if (!tanggal) return "";
  const lahir = new Date(`${tanggal}T00:00:00`);
  const kini = new Date();
  let bulan = (kini.getFullYear() - lahir.getFullYear()) * 12 + (kini.getMonth() - lahir.getMonth());
  if (kini.getDate() < lahir.getDate()) bulan -= 1;
  if (bulan < 0) return "";
  const tahun = Math.floor(bulan / 12);
  const sisa = bulan % 12;
  return `${bulan} bulan${tahun > 0 ? ` (${tahun} tahun ${sisa} bulan)` : ""}`;
}

export default function FormulirTrial({ leadId, formId }: { leadId?: string; formId?: string }) {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState<FormData | null>(null);
  const [accLog, setAccLog] = useState<AccLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tglLahir, setTglLahir] = useState("");
  const [gender, setGender] = useState("");
  const [pilihan, setPilihan] = useState<"ZKC" | "SAM">("ZKC");
  const [programId, setProgramId] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [sinyal, setSinyal] = useState(false);
  const [sinyalCatatan, setSinyalCatatan] = useState("");
  const [observasi, setObservasi] = useState("");
  const [riwayat, setRiwayat] = useState<Record<string, string>>({});
  const [samAnak, setSamAnak] = useState<Record<string, string>>({});
  const [samOrtu, setSamOrtu] = useState<string[]>(Array(7).fill(""));
  const [setuju, setSetuju] = useState(false);

  const [accKeputusan, setAccKeputusan] = useState("disetujui");
  const [accCatatan, setAccCatatan] = useState("");
  const [discStatus, setDiscStatus] = useState("sesuai");
  const [discCatatan, setDiscCatatan] = useState("");

  const isiDariForm = useCallback((f: FormData) => {
    setForm(f);
    setTglLahir((f.child_birth_date || "").slice(0, 10));
    setGender(f.child_gender || "");
    setPilihan(f.program_pilihan === "SAM" ? "SAM" : "ZKC");
    setProgramId(f.program_id || "");
    setTujuan(f.tujuan_keluarga || "");
    setSinyal(Boolean(f.sinyal_dukungan_konsisten));
    setSinyalCatatan(f.sinyal_catatan || "");
    setObservasi(String((f.observasi_awal as Record<string, unknown>)?.ringkasan || ""));
    const r: Record<string, string> = {};
    for (const [k] of RIWAYAT_FIELD) r[k] = String((f.riwayat_awal as Record<string, unknown>)?.[k] || "");
    setRiwayat(r);
    const sa: Record<string, string> = {};
    for (const g of GUGUS_SAM_ANAK) sa[g.kunci] = f.filter_sam_anak?.[g.kunci] ? String(f.filter_sam_anak[g.kunci]) : "";
    setSamAnak(sa);
    const so = Array(7).fill("");
    (f.filter_sam_ortu || []).forEach((v, i) => { if (i < 7) so[i] = String(v || ""); });
    setSamOrtu(so);
    setSetuju(Boolean(f.kesepakatan_awal));
    setDiscStatus(f.discovery_status || "sesuai");
    setDiscCatatan(f.discovery_catatan || "");
  }, []);

  const muat = useCallback(() => {
    fetch("/api/admission")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPrograms(d.programs || []); })
      .catch(() => undefined);
    if (formId) {
      fetch(`/api/admission/trial/${formId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok) { setError(d.error); return; }
          isiDariForm(d.form);
          setAccLog(d.acc_log || []);
        })
        .catch(() => setError("Tidak dapat menghubungi server."));
    } else {
      setForm({});
    }
  }, [formId, isiDariForm]);

  useEffect(muat, [muat]);

  const payload = useMemo(() => {
    const anak: Record<string, number> = {};
    for (const g of GUGUS_SAM_ANAK) {
      const n = Number(samAnak[g.kunci]);
      if (n >= 1 && n <= 4) anak[g.kunci] = n;
    }
    return {
      lead_id: leadId,
      child_birth_date: tglLahir || null,
      child_gender: gender || null,
      program_pilihan: pilihan,
      program_id: programId || null,
      tujuan_keluarga: tujuan || null,
      sinyal_dukungan_konsisten: sinyal,
      sinyal_catatan: sinyalCatatan || null,
      observasi_awal: observasi ? { ringkasan: observasi } : {},
      riwayat_awal: riwayat,
      filter_sam_anak: pilihan === "SAM" && Object.keys(anak).length > 0 ? anak : null,
      filter_sam_ortu: pilihan === "SAM" && samOrtu.some((v) => v) ? samOrtu.map((v) => Number(v) || 0) : null,
      kesepakatan_awal: setuju,
    };
  }, [leadId, tglLahir, gender, pilihan, programId, tujuan, sinyal, sinyalCatatan, observasi, riwayat, samAnak, samOrtu, setuju]);

  async function simpan(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(formId ? `/api/admission/trial/${formId}` : "/api/admission/trial", {
      method: formId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) {
      if (d.existing_id) {
        router.push(`/admission/trial/${d.existing_id}`);
        return;
      }
      setError(d.error || "Gagal menyimpan formulir.");
      return;
    }
    if (!formId && d.id) {
      router.push(`/admission/trial/${d.id}`);
      return;
    }
    setInfo("Formulir tersimpan. Filter Arah dan Filter SAM dihitung ulang oleh server.");
    muat();
  }

  async function kirimAksi(aksi: Record<string, unknown>, pesan: string) {
    if (!formId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admission/trial/${formId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aksi),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error || "Gagal menyimpan."); return; }
    setInfo(pesan);
    muat();
  }

  if (error && !form) return <ErrorState message={error} />;
  if (!form) return <LoadingState />;

  const skalaSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Belum dinilai</option>
      {SKALA_KATA_4.map((kata, i) => (
        <option key={kata} value={String(i + 1)}>{kata}</option>
      ))}
    </select>
  );

  return (
    <>
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <form onSubmit={simpan}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Data Anak & Pilihan Keluarga</h2>
          {form.child_name ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Anak: <strong>{form.child_name}</strong> · Orang tua: {form.parent_name || "-"} · WhatsApp: {form.wa_number || "-"}
            </p>
          ) : null}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ft_lahir">Tanggal lahir anak *</label>
              <input id="ft_lahir" type="date" required value={tglLahir} onChange={(e) => setTglLahir(e.target.value)} />
              {tglLahir ? <small className="muted">Umur terhitung otomatis: {umurTeks(tglLahir)}</small> : null}
            </div>
            <div className="field">
              <label htmlFor="ft_gender">Jenis kelamin</label>
              <select id="ft_gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Belum diisi</option>
                <option value="laki_laki">Laki-laki</option>
                <option value="perempuan">Perempuan</option>
              </select>
            </div>
            <div className="field">
              <label>Rumah yang diinginkan orang tua *</label>
              <div className="row" style={{ gap: 14 }}>
                <label><input type="radio" name="pilihan" checked={pilihan === "ZKC"} onChange={() => setPilihan("ZKC")} /> Ziel Kids Club</label>
                <label><input type="radio" name="pilihan" checked={pilihan === "SAM"} onChange={() => setPilihan("SAM")} /> Sekolah Alam Montessori</label>
              </div>
              <small className="muted">Saran Filter Arah tidak pernah menimpa pilihan ini.</small>
            </div>
            <div className="field">
              <label htmlFor="ft_program">Program spesifik (bila sudah tahu)</label>
              <select id="ft_program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">Belum ditentukan</option>
                {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="ft_tujuan">Tujuan utama keluarga</label>
              <textarea id="ft_tujuan" rows={2} value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Apa yang terutama dicari keluarga dari program ini" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Blok Observasi Awal Orang Tua</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Blok resmi berisi 19 pertanyaan dalam 7 gugus; teks butirnya dimuat dari Paket Sistem Terpadu
            versi final lembaga. Selama paket belum termuat, ringkasan observasi awal dicatat di sini dan
            penanda kebutuhan dukungan di bawah ini yang menggerakkan Filter Arah.
          </p>
          <div className="field">
            <label htmlFor="ft_obs">Ringkasan observasi awal orang tua</label>
            <textarea id="ft_obs" rows={3} value={observasi} onChange={(e) => setObservasi(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>
              <input type="checkbox" checked={sinyal} onChange={(e) => setSinyal(e.target.checked)} />{" "}
              Teramati sinyal kebutuhan dukungan perkembangan yang konsisten
            </label>
            <small className="muted">Bila tercentang, Filter Arah mengarahkan anak ke Ziel Kids Club dahulu untuk membangun fondasi.</small>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="ft_sinyal_cat">Catatan sinyal / triase</label>
            <textarea id="ft_sinyal_cat" rows={2} value={sinyalCatatan} onChange={(e) => setSinyalCatatan(e.target.value)} />
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Blok Riwayat Awal & Konteks Keluarga</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Seluruh isian blok ini adalah <strong>keterangan orang tua</strong>, selaras dengan wawancara
            anamnesis lembaga — bukan rekam medis. Blok ini menjadi bagian Kartu Gambaran Awal anak.
          </p>
          <div className="form-grid">
            {RIWAYAT_FIELD.map(([kunci, label, hint]) => (
              <div className="field" key={kunci}>
                <label htmlFor={`rw_${kunci}`}>{label}</label>
                <textarea
                  id={`rw_${kunci}`}
                  rows={2}
                  placeholder={hint}
                  value={riwayat[kunci] || ""}
                  onChange={(e) => setRiwayat({ ...riwayat, [kunci]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {pilihan === "SAM" ? (
          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Filter SAM Dua Sisi</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Dinilai dengan skala kata empat tingkat. Kesiapan Berpisah adalah gugus penentu di sisi anak.
              Hasil gabungan selalu disertai alasan dan tidak berbunyi vonis.
            </p>
            <h3>Sisi anak — penilaian gugus oleh orang tua</h3>
            <div className="form-grid">
              {GUGUS_SAM_ANAK.map((g) => (
                <div className="field" key={g.kunci}>
                  <label htmlFor={`sam_${g.kunci}`}>{g.label} ({g.butir} butir){"penentu" in g && g.penentu ? " — penentu" : ""}</label>
                  {skalaSelect(samAnak[g.kunci] || "", (v) => setSamAnak({ ...samAnak, [g.kunci]: v }), `sam_${g.kunci}`)}
                </div>
              ))}
            </div>
            <h3>Sisi orang tua — Kesiapan Pola Pikir (7 butir)</h3>
            <div className="form-grid">
              {BUTIR_SAM_ORTU.map((butir, i) => (
                <div className="field" key={butir}>
                  <label htmlFor={`so_${i}`}>{butir}</label>
                  {skalaSelect(samOrtu[i] || "", (v) => {
                    const salin = [...samOrtu];
                    salin[i] = v;
                    setSamOrtu(salin);
                  }, `so_${i}`)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Kesepakatan Awal Keluarga</h2>
          <KesepakatanAwal />
          <label style={{ display: "block", marginTop: 10 }}>
            <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />{" "}
            Kami sudah membaca dan menyepakati kesepakatan awal keluarga ini
          </label>
          {form.kesepakatan_awal_at ? (
            <p className="muted">Tercatat disetujui pada {tanggalPanjang(form.kesepakatan_awal_at)}.</p>
          ) : (
            <p className="muted">Centang dan waktu persetujuan tercatat pada data anak dan dapat dibuka dari profil anak serta Portal Orang Tua.</p>
          )}
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : formId ? "Simpan & Hitung Ulang Filter" : "Simpan Formulir & Jalankan Filter"}
            </button>
          </div>
        </div>
      </form>

      {formId && form.arah_rekomendasi ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Hasil Filter Arah</h2>
          <p style={{ fontSize: 18, margin: "4px 0" }}>
            Rekomendasi: <strong>{LABEL_ARAH[form.arah_rekomendasi as keyof typeof LABEL_ARAH] || form.arah_rekomendasi}</strong>
            <span className="badge neutral" style={{ marginLeft: 8 }}>Keyakinan: {form.arah_keyakinan}</span>
            {form.arah_berbeda ? <span className="badge warn" style={{ marginLeft: 6 }}>Berbeda dari pilihan orang tua</span> : null}
          </p>
          <div style={{ whiteSpace: "pre-line" }}>{form.arah_alasan}</div>
          {form.sam_hasil ? (
            <>
              <h3>Filter SAM: {LABEL_HASIL_SAM[form.sam_hasil as keyof typeof LABEL_HASIL_SAM] || form.sam_hasil}</h3>
              <div style={{ whiteSpace: "pre-line" }}>{form.sam_alasan}</div>
            </>
          ) : null}
        </div>
      ) : null}

      {formId ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>ACC Arah — Guru Program Terkait</h2>
          {form.acc_status && form.acc_status !== "menunggu" ? (
            <p>
              Status: <strong>{form.acc_status === "disetujui" ? "Disetujui" : "Disetujui bersyarat"}</strong>
              {form.acc_nama ? <> oleh {form.acc_nama}</> : null}
              {form.acc_at ? <> · {tanggalPanjang(form.acc_at)}</> : null}
              {form.acc_catatan ? <div className="muted">{form.acc_catatan}</div> : null}
            </p>
          ) : (
            <p className="muted">Belum ada ACC. Persetujuan arah dilakukan guru pendamping program terkait (guru ZKC / guide SAM); founder dan manager memantau serta membaca riwayatnya.</p>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="acc_kep">Keputusan</label>
              <select id="acc_kep" value={accKeputusan} onChange={(e) => setAccKeputusan(e.target.value)}>
                <option value="disetujui">Setujui arah</option>
                <option value="disetujui_bersyarat">Setujui dengan catatan / syarat</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="acc_cat">Catatan ACC</label>
              <input id="acc_cat" value={accCatatan} onChange={(e) => setAccCatatan(e.target.value)} />
            </div>
          </div>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            style={{ marginTop: 10 }}
            onClick={() => void kirimAksi({ aksi: "acc", keputusan: accKeputusan, catatan: accCatatan }, "ACC arah tercatat.")}
          >
            Beri ACC
          </button>
          {accLog.length > 0 ? (
            <>
              <h3>Riwayat ACC</h3>
              <ul>
                {accLog.map((log) => (
                  <li key={log.id}>
                    {tanggalPanjang(log.created_at)} — {log.oleh_nama}
                    {log.oleh_peran ? <span className="muted"> ({log.oleh_peran})</span> : null}
                    {": "}{log.keputusan === "disetujui" ? "Disetujui" : "Disetujui bersyarat"}
                    {log.program ? <> · program {log.program}</> : null}
                    {log.catatan ? <div className="muted">{log.catatan}</div> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {formId ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Discovery — Konfirmasi Lapangan</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Discovery mengonfirmasi hasil formulir di lapangan. Bila hasilnya berbeda, alasannya wajib dicatat.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="disc_status">Hasil Discovery terhadap formulir</label>
              <select id="disc_status" value={discStatus} onChange={(e) => setDiscStatus(e.target.value)}>
                <option value="sesuai">Sesuai hasil formulir</option>
                <option value="berbeda">Berbeda dari hasil formulir</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="disc_cat">Catatan / alasan perbedaan</label>
              <input id="disc_cat" value={discCatatan} onChange={(e) => setDiscCatatan(e.target.value)} />
            </div>
          </div>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            style={{ marginTop: 10 }}
            onClick={() => void kirimAksi({ aksi: "discovery", discovery_status: discStatus, discovery_catatan: discCatatan }, "Catatan Discovery tersimpan.")}
          >
            Simpan Catatan Discovery
          </button>
        </div>
      ) : null}
    </>
  );
}
