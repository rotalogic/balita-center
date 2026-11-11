"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, PageHead } from "@/components/chrome";

type Meta = {
  branches: Array<{ id: string; code: string; name: string }>;
  programs: Array<{ id: string; code: string; name: string; area?: string }>;
  classes: Array<{ id: string; branch_id: string; program_id: string; name: string }>;
  staff: Array<{ id: string; branch_id: string; full_name: string; position: string }>;
};
const emptyMeta: Meta = { branches: [], programs: [], classes: [], staff: [] };
const STEPS = ["Data Anak", "Orang Tua / Wali", "Data Tambahan", "Konfirmasi"];

export default function TambahAnakPage() {
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ gender: "perempuan", photo_consent: "true" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [setup, setSetup] = useState<Record<string, string>>({});
  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const loadMeta = () => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((data) => (data.ok ? setMeta(data) : setMetaError(data.error)))
      .catch(() => setMetaError("Tidak dapat menghubungi server."));
  };
  useEffect(loadMeta, []);

  // Mode dari pipeline Admission: /anak/tambah?lead=<id>
  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (!leadId) return;
    fetch("/api/admission")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const lead = (d.leads || []).find((item: { id: string }) => item.id === leadId);
        if (!lead) return;
        setForm((prev) => ({
          ...prev,
          lead_id: lead.id,
          branch_id: lead.branch_id || prev.branch_id || "",
          full_name: lead.child_name || "",
          guardian_name: lead.parent_name || "",
          guardian_phone: lead.wa_number || "",
        }));
      })
      .catch(() => null);
  }, []);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (data.ok) set("photo_url", data.url);
      else setResult({ ok: false, message: data.error || "Gagal mengunggah foto." });
    } catch {
      setResult({ ok: false, message: "Gagal mengunggah foto." });
    } finally {
      setUploading(false);
    }
  }
  const classesFor = meta.classes.filter(
    (c) => (!form.branch_id || c.branch_id === form.branch_id) && (!form.program_id || c.program_id === form.program_id)
  );

  async function submitSetup(kind: string) {
    setSetupMsg(null);
    const payloads: Record<string, Record<string, string>> = {
      branch: { kind, code: setup.branch_code || "", name: setup.branch_name || "", city: setup.branch_city || "" },
      program: { kind, code: setup.program_code || "", name: setup.program_name || "", monthly_fee: setup.monthly_fee || "", screening_fee: setup.screening_fee || "", area: setup.program_area || "ZKC" },
      class: { kind, branch_id: setup.class_branch || "", program_id: setup.class_program || "", name: setup.class_name || "" },
      staff: { kind, branch_id: setup.staff_branch || "", full_name: setup.staff_name || "", position: setup.staff_position || "", phone: setup.staff_phone || "", email: setup.staff_email || "" },
    };
    const res = await fetch("/api/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloads[kind]) });
    const data = await res.json();
    if (data.ok) { setSetupMsg(`${kind} tersimpan.`); loadMeta(); } else { setSetupMsg(data.error || "Gagal menyimpan data awal."); }
  }

  function nextStep() {
    if (step === 1 && !form.full_name) {
      setErrors({ full_name: "Nama lengkap wajib diisi sebelum lanjut." });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.branch_id) nextErrors.branch_id = "Cabang wajib dipilih.";
    if (!form.program_id) nextErrors.program_id = "Program wajib dipilih.";
    if (!form.class_id) nextErrors.class_id = "Kelas wajib dipilih.";
    if (!form.kategori_program) nextErrors.kategori_program = "Kategori program (ZKC/SAM) wajib dipilih secara tegas.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setResult({ ok: true, message: "Data anak tersimpan beserta wali dan pendaftarannya.", id: data.id });
      setForm({ gender: "perempuan", photo_consent: "true" });
      setStep(1);
    } else {
      setResult({ ok: false, message: data.error || "Gagal menyimpan data anak." });
    }
  }

  const branchName = meta.branches.find((b) => b.id === form.branch_id)?.name;
  const programName = meta.programs.find((p) => p.id === form.program_id)?.name;
  const className = meta.classes.find((c) => c.id === form.class_id)?.name;

  return (
    <>
      <PageHead title="Tambah Anak Didik" subtitle="Lengkapi informasi anak didik baru di Balita Center" />
      {metaError ? <ErrorState message={metaError} /> : null}

      <section className="card">
        <h2>Data Awal (wajib ada sebelum menambah anak)</h2>
        <p className="muted">Dari database kosong, buat berurutan: cabang, program, kelas, dan staf.</p>
        <div className="form-grid">
          <div className="field">
            <label>Cabang: kode + nama</label>
            <div className="row">
              <input placeholder="Kode, mis. MLG" value={setup.branch_code || ""} onChange={(e) => setSetup({ ...setup, branch_code: e.target.value })} />
              <input placeholder="Nama cabang" value={setup.branch_name || ""} onChange={(e) => setSetup({ ...setup, branch_name: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("branch")}>Simpan Cabang</button>
            </div>
            <span className="hint">{meta.branches.length} cabang terdaftar</span>
          </div>
          <div className="field">
            <label>Program: kode + nama + SPP/bulan</label>
            <div className="row">
              <input placeholder="Kode, mis. REG" value={setup.program_code || ""} onChange={(e) => setSetup({ ...setup, program_code: e.target.value })} />
              <input placeholder="Nama program" value={setup.program_name || ""} onChange={(e) => setSetup({ ...setup, program_name: e.target.value })} />
              <input placeholder="SPP" type="number" min="0" value={setup.monthly_fee || ""} onChange={(e) => setSetup({ ...setup, monthly_fee: e.target.value })} />
              <select value={setup.program_area || "ZKC"} onChange={(e) => setSetup({ ...setup, program_area: e.target.value })} aria-label="Rumah program">
                <option value="ZKC">Ziel Kids Club</option>
                <option value="SAM">Sekolah Alam Montessori</option>
              </select>
              <button type="button" className="btn small" onClick={() => submitSetup("program")}>Simpan Program</button>
            </div>
            <span className="hint">{meta.programs.length} program terdaftar</span>
          </div>
          <div className="field">
            <label>Kelas baru</label>
            <div className="row">
              <select value={setup.class_branch || ""} onChange={(e) => setSetup({ ...setup, class_branch: e.target.value })} aria-label="Cabang untuk kelas">
                <option value="">Pilih cabang</option>
                {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
              <select value={setup.class_program || ""} onChange={(e) => setSetup({ ...setup, class_program: e.target.value })} aria-label="Program untuk kelas">
                <option value="">Pilih program</option>
                {meta.programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <input placeholder="Nama kelas, mis. Toddler A" value={setup.class_name || ""} onChange={(e) => setSetup({ ...setup, class_name: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("class")}>Simpan Kelas</button>
            </div>
            <span className="hint">{meta.classes.length} kelas terdaftar</span>
          </div>
          <div className="field">
            <label>Staf / guru baru</label>
            <div className="row">
              <select value={setup.staff_branch || ""} onChange={(e) => setSetup({ ...setup, staff_branch: e.target.value })} aria-label="Cabang untuk staf">
                <option value="">Pilih cabang</option>
                {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
              <input placeholder="Nama staf" value={setup.staff_name || ""} onChange={(e) => setSetup({ ...setup, staff_name: e.target.value })} />
              <input placeholder="Jabatan, mis. Guru Kelas" value={setup.staff_position || ""} onChange={(e) => setSetup({ ...setup, staff_position: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("staff")}>Simpan Staf</button>
            </div>
            <span className="hint">{meta.staff.length} staf terdaftar. Staf dipakai sebagai pembuat dan reviewer laporan harian.</span>
          </div>
        </div>
        {setupMsg ? <p className="notice" role="status">{setupMsg}</p> : null}
      </section>

      <form className="card" onSubmit={submit} noValidate>
        <ol className="wizard-steps" aria-label="Langkah pendaftaran">
          {STEPS.map((label, i) => (
            <li key={label} className={step === i + 1 ? "wizard-step current" : step > i + 1 ? "wizard-step done" : "wizard-step"} aria-current={step === i + 1 ? "step" : undefined}>
              <span className="num">{step > i + 1 ? "✓" : i + 1}</span> {label}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <>
            <h2>1. Data Anak</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="full_name">Nama Lengkap Anak *</label><input id="full_name" value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} required />{errors.full_name ? <span className="err">{errors.full_name}</span> : null}</div>
              <div className="field"><label htmlFor="nickname">Nama Panggilan</label><input id="nickname" value={form.nickname || ""} onChange={(e) => set("nickname", e.target.value)} /></div>
              <div className="field"><label>Jenis Kelamin *</label><div className="choice-row" role="radiogroup" aria-label="Jenis kelamin">{["laki_laki", "perempuan"].map((g) => (<button type="button" key={g} className={form.gender === g ? "choice selected" : "choice"} onClick={() => set("gender", g)} aria-pressed={form.gender === g}>{g === "laki_laki" ? "Laki-laki" : "Perempuan"}</button>))}</div></div>
              <div className="field"><label htmlFor="birth_date">Tanggal Lahir</label><input id="birth_date" type="date" value={form.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} /></div>
              <div className="field"><label htmlFor="birth_place">Tempat Lahir</label><input id="birth_place" value={form.birth_place || ""} onChange={(e) => set("birth_place", e.target.value)} /></div>
              <div className="field"><label htmlFor="religion">Agama</label><input id="religion" value={form.religion || ""} onChange={(e) => set("religion", e.target.value)} /></div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>2. Data Orang Tua / Wali (utama)</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="guardian_name">Nama Wali</label><input id="guardian_name" value={form.guardian_name || ""} onChange={(e) => set("guardian_name", e.target.value)} /></div>
              <div className="field"><label htmlFor="guardian_relation">Hubungan</label><input id="guardian_relation" placeholder="Ayah / Ibu / Wali" value={form.guardian_relation || ""} onChange={(e) => set("guardian_relation", e.target.value)} /></div>
              <div className="field"><label htmlFor="guardian_phone">Nomor WhatsApp</label><input id="guardian_phone" type="tel" value={form.guardian_phone || ""} onChange={(e) => set("guardian_phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="guardian_email">Email</label><input id="guardian_email" type="email" value={form.guardian_email || ""} onChange={(e) => set("guardian_email", e.target.value)} /></div>
              <div className="field"><label htmlFor="guardian_nik">NIK</label><input id="guardian_nik" value={form.guardian_nik || ""} onChange={(e) => set("guardian_nik", e.target.value)} /></div>
              <div className="field"><label htmlFor="guardian_occupation">Pekerjaan</label><input id="guardian_occupation" value={form.guardian_occupation || ""} onChange={(e) => set("guardian_occupation", e.target.value)} /></div>
              <div className="field full"><label htmlFor="guardian_address">Alamat</label><input id="guardian_address" value={form.guardian_address || ""} onChange={(e) => set("guardian_address", e.target.value)} /></div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>3. Data Tambahan &amp; Kesehatan</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="blood_type">Golongan Darah</label>
                <select id="blood_type" value={form.blood_type || ""} onChange={(e) => set("blood_type", e.target.value)}>
                  <option value="">Belum diisi</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
                <span className="hint">Kosongkan bila belum diketahui — jangan diisi asal.</span></div>
              <div className="field"><label htmlFor="special_needs">Kebutuhan Khusus</label><input id="special_needs" placeholder="Tidak ada" value={form.special_needs || ""} onChange={(e) => set("special_needs", e.target.value)} /></div>
              <div className="field"><label htmlFor="languages">Bahasa yang Dikuasai</label><input id="languages" value={form.languages || ""} onChange={(e) => set("languages", e.target.value)} /></div>
              <div className="field"><label htmlFor="hobbies">Hobi / Minat</label><input id="hobbies" value={form.hobbies || ""} onChange={(e) => set("hobbies", e.target.value)} /></div>
              <div className="field"><label htmlFor="transport_mode">Transportasi</label><input id="transport_mode" placeholder="Diantar Orang Tua" value={form.transport_mode || ""} onChange={(e) => set("transport_mode", e.target.value)} /></div>
              <div className="field"><label htmlFor="health_notes">Catatan Kesehatan / Alergi</label><input id="health_notes" value={form.health_notes || ""} onChange={(e) => set("health_notes", e.target.value)} /></div>
              <div className="field">
                <label htmlFor="photo_file">Foto Anak</label>
                <input id="photo_file" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploading} />
                <span className="hint">{uploading ? "Mengunggah…" : "JPG/PNG/WEBP, maks 5 MB."}</span>
                {form.photo_url ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.photo_url} alt="Foto anak" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }} />
                    <button type="button" className="btn small secondary" onClick={() => set("photo_url", "")}>Hapus foto</button>
                  </div>
                ) : null}
              </div>
              <div className="field"><label>Perbolehan Foto &amp; Video</label><div className="choice-row">{[["true", "Diizinkan"], ["false", "Tidak diizinkan"]].map(([v, label]) => (<button type="button" key={v} className={form.photo_consent === v ? "choice selected" : "choice"} onClick={() => set("photo_consent", v)} aria-pressed={form.photo_consent === v}>{label}</button>))}</div></div>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2>4. Konfirmasi Pendaftaran</h2>
            <div className="notice" role="note" style={{ marginBottom: 14 }}>
              Periksa ringkasan: <strong>{form.full_name || "(nama belum diisi)"}</strong>
              {form.guardian_name ? <> · Wali: {form.guardian_name}</> : null}
              {branchName ? <> · {branchName}</> : null}
              {programName ? <> · {programName}</> : null}
              {className ? <> · Kelas {className}</> : null}
            </div>
            <div className="form-grid">
              <div className="field"><label htmlFor="branch_id">Cabang *</label><select id="branch_id" value={form.branch_id || ""} onChange={(e) => { set("branch_id", e.target.value); set("class_id", ""); }} required><option value="">Pilih cabang</option>{meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select>{errors.branch_id ? <span className="err">{errors.branch_id}</span> : null}</div>
              <div className="field"><label htmlFor="program_id">Program *</label><select id="program_id" value={form.program_id || ""} onChange={(e) => { set("program_id", e.target.value); set("class_id", ""); const p = meta.programs.find((x) => x.id === e.target.value); set("kategori_program", p?.area === "SAM" ? "SAM" : "ZKC"); }} required><option value="">Pilih program</option>{meta.programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>{errors.program_id ? <span className="err">{errors.program_id}</span> : null}</div>
              <div className="field"><label htmlFor="kategori_program">Kategori Program *</label><select id="kategori_program" value={form.kategori_program || ""} onChange={(e) => set("kategori_program", e.target.value)} required><option value="">Pilih kategori</option><option value="ZKC">Ziel Kids Club (ZKC)</option><option value="SAM">Sekolah Alam Montessori (SAM)</option></select><span className="hint">Kategori menentukan program, cara pencatatan perkembangan, dan laporan anak. Terisi mengikuti program, tetap wajib ditegaskan.</span>{errors.kategori_program ? <span className="err">{errors.kategori_program}</span> : null}</div>
              <div className="field"><label htmlFor="label_status">Label Status Anak</label><select id="label_status" value={form.label_status || "Anggota"} onChange={(e) => set("label_status", e.target.value)}>{["Anggota", "Trial", "Insidentil", "Peserta Event", "Klien Skrining", "Klien Konsultasi"].map((l) => (<option key={l} value={l}>{l}</option>))}</select></div>
              <div className="field"><label htmlFor="class_id">Kelas yang Dituju *</label><select id="class_id" value={form.class_id || ""} onChange={(e) => set("class_id", e.target.value)} required><option value="">Pilih kelas</option>{classesFor.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>{classesFor.length === 0 ? (<span className="hint">Belum ada kelas untuk cabang &amp; program ini. Buat dulu di panel <strong>Data Awal</strong> di atas.</span>) : null}{errors.class_id ? <span className="err">{errors.class_id}</span> : null}</div>
              <div className="field"><label htmlFor="enrolled_on">Tanggal Masuk</label><input id="enrolled_on" type="date" value={form.enrolled_on || ""} onChange={(e) => set("enrolled_on", e.target.value)} /></div>
            </div>
          </>
        ) : null}

        {result ? (
          <p className={result.ok ? "success" : "notice"} role="status" style={{ marginTop: 16 }}>
            {result.message} {result.ok && result.id ? <Link href={`/anak/${result.id}`}>Lihat detail anak</Link> : null}
          </p>
        ) : null}
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn secondary" href="/anak">Batal</Link>
          {step > 1 ? <button type="button" className="btn secondary" onClick={() => setStep((s) => Math.max(1, s - 1))}>Kembali</button> : null}
          {step < 4 ? <button type="button" className="btn" onClick={nextStep}>Lanjut ke {STEPS[step]}</button> : null}
          {step === 4 ? <button className="btn" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Data Anak"}</button> : null}
        </div>
      </form>
    </>
  );
}
