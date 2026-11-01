"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, PageHead } from "@/components/chrome";

type Meta = {
  branches: Array<{ id: string; code: string; name: string }>;
  programs: Array<{ id: string; code: string; name: string }>;
  classes: Array<{ id: string; branch_id: string; program_id: string; name: string }>;
  staff: Array<{ id: string; branch_id: string; full_name: string; position: string }>;
};

const emptyMeta: Meta = { branches: [], programs: [], classes: [], staff: [] };

export default function TambahAnakPage() {
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ gender: "perempuan", photo_consent: "true" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [setup, setSetup] = useState<Record<string, string>>({});
  const [setupMsg, setSetupMsg] = useState<string | null>(null);

  const loadMeta = () => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((data) => (data.ok ? setMeta(data) : setMetaError(data.error)))
      .catch(() => setMetaError("Tidak dapat menghubungi server."));
  };
  useEffect(loadMeta, []);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const classesFor = meta.classes.filter(
    (c) => (!form.branch_id || c.branch_id === form.branch_id) && (!form.program_id || c.program_id === form.program_id)
  );

  async function submitSetup(kind: string) {
    setSetupMsg(null);
    const res = await fetch("/api/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...setup }),
    });
    const data = await res.json();
    if (data.ok) {
      setSetupMsg(`${kind} tersimpan.`);
      loadMeta();
    } else {
      setSetupMsg(data.error || "Gagal menyimpan data awal.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.full_name) nextErrors.full_name = "Nama lengkap wajib diisi.";
    if (!form.branch_id) nextErrors.branch_id = "Cabang wajib dipilih.";
    if (!form.program_id) nextErrors.program_id = "Program wajib dipilih.";
    if (!form.class_id) nextErrors.class_id = "Kelas wajib dipilih.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setResult({ ok: true, message: "Data anak tersimpan beserta wali dan pendaftarannya.", id: data.id });
      setForm({ gender: "perempuan", photo_consent: "true" });
    } else {
      setResult({ ok: false, message: data.error || "Gagal menyimpan data anak." });
    }
  }

  return (
    <>
      <PageHead title="Tambah Anak Didik" subtitle="Lengkapi informasi anak didik baru di Balita Center" />
      {metaError ? <ErrorState message={metaError} /> : null}

      <section className="card">
        <h2>Data Awal (wajib ada sebelum menambah anak)</h2>
        <p className="muted">Dari database kosong, buat berurutan: cabang, program, kelas, dan staf. Formulir ini menembak tabel master yang sama dengan yang dipakai aplikasi.</p>
        <div className="form-grid">
          <div className="field">
            <label>Cabang: kode + nama</label>
            <div className="row">
              <input placeholder="Kode, mis. MLG" value={setup.branch_code || ""} onChange={(e) => setSetup({ ...setup, branch_code: e.target.value, code: e.target.value })} />
              <input placeholder="Nama cabang" value={setup.branch_name || ""} onChange={(e) => setSetup({ ...setup, branch_name: e.target.value, name: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("branch")}>Simpan Cabang</button>
            </div>
            <span className="hint">{meta.branches.length} cabang terdaftar</span>
          </div>
          <div className="field">
            <label>Program: kode + nama + SPP/bulan</label>
            <div className="row">
              <input placeholder="Kode, mis. REG" value={setup.program_code || ""} onChange={(e) => setSetup({ ...setup, program_code: e.target.value, code: e.target.value })} />
              <input placeholder="Nama program" value={setup.program_name || ""} onChange={(e) => setSetup({ ...setup, program_name: e.target.value, name: e.target.value })} />
              <input placeholder="SPP" type="number" min="0" value={setup.monthly_fee || ""} onChange={(e) => setSetup({ ...setup, monthly_fee: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("program")}>Simpan Program</button>
            </div>
            <span className="hint">{meta.programs.length} program terdaftar</span>
          </div>
          <div className="field">
            <label>Kelas baru</label>
            <div className="row">
              <select value={setup.class_branch || ""} onChange={(e) => setSetup({ ...setup, class_branch: e.target.value, branch_id: e.target.value })} aria-label="Cabang untuk kelas">
                <option value="">Pilih cabang</option>
                {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
              <select value={setup.class_program || ""} onChange={(e) => setSetup({ ...setup, class_program: e.target.value, program_id: e.target.value })} aria-label="Program untuk kelas">
                <option value="">Pilih program</option>
                {meta.programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <input placeholder="Nama kelas, mis. Toddler A" value={setup.class_name || ""} onChange={(e) => setSetup({ ...setup, class_name: e.target.value, name: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("class")}>Simpan Kelas</button>
            </div>
            <span className="hint">{meta.classes.length} kelas terdaftar</span>
          </div>
          <div className="field">
            <label>Staf / guru baru</label>
            <div className="row">
              <select value={setup.staff_branch || ""} onChange={(e) => setSetup({ ...setup, staff_branch: e.target.value, branch_id: e.target.value })} aria-label="Cabang untuk staf">
                <option value="">Pilih cabang</option>
                {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
              <input placeholder="Nama staf" value={setup.staff_name || ""} onChange={(e) => setSetup({ ...setup, staff_name: e.target.value, full_name: e.target.value })} />
              <input placeholder="Jabatan, mis. Guru Kelas" value={setup.staff_position || ""} onChange={(e) => setSetup({ ...setup, staff_position: e.target.value, position: e.target.value })} />
              <button type="button" className="btn small" onClick={() => submitSetup("staff")}>Simpan Staf</button>
            </div>
            <span className="hint">{meta.staff.length} staf terdaftar. Staf dipakai sebagai pembuat dan reviewer laporan harian.</span>
          </div>
        </div>
        {setupMsg ? <p className="notice" role="status">{setupMsg}</p> : null}
      </section>

      <form className="card" onSubmit={submit} noValidate>
        <h2>1. Data Anak</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="full_name">Nama Lengkap Anak *</label>
            <input id="full_name" value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} required />
            {errors.full_name ? <span className="err">{errors.full_name}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="nickname">Nama Panggilan</label>
            <input id="nickname" value={form.nickname || ""} onChange={(e) => set("nickname", e.target.value)} />
          </div>
          <div className="field">
            <label>Jenis Kelamin *</label>
            <div className="choice-row" role="radiogroup" aria-label="Jenis kelamin">
              {["laki_laki", "perempuan"].map((g) => (
                <button type="button" key={g} className={form.gender === g ? "choice selected" : "choice"} onClick={() => set("gender", g)} aria-pressed={form.gender === g}>
                  {g === "laki_laki" ? "Laki-laki" : "Perempuan"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="birth_date">Tanggal Lahir</label>
            <input id="birth_date" type="date" value={form.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="birth_place">Tempat Lahir</label>
            <input id="birth_place" value={form.birth_place || ""} onChange={(e) => set("birth_place", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="religion">Agama</label>
            <input id="religion" value={form.religion || ""} onChange={(e) => set("religion", e.target.value)} />
          </div>
        </div>

        <h2 style={{ marginTop: 22 }}>2. Data Orang Tua / Wali (utama)</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="guardian_name">Nama Wali</label><input id="guardian_name" value={form.guardian_name || ""} onChange={(e) => set("guardian_name", e.target.value)} /></div>
          <div className="field"><label htmlFor="guardian_relation">Hubungan</label><input id="guardian_relation" placeholder="Ayah / Ibu / Wali" value={form.guardian_relation || ""} onChange={(e) => set("guardian_relation", e.target.value)} /></div>
          <div className="field"><label htmlFor="guardian_phone">Nomor WhatsApp</label><input id="guardian_phone" type="tel" value={form.guardian_phone || ""} onChange={(e) => set("guardian_phone", e.target.value)} /></div>
          <div className="field"><label htmlFor="guardian_email">Email</label><input id="guardian_email" type="email" value={form.guardian_email || ""} onChange={(e) => set("guardian_email", e.target.value)} /></div>
          <div className="field"><label htmlFor="guardian_nik">NIK</label><input id="guardian_nik" value={form.guardian_nik || ""} onChange={(e) => set("guardian_nik", e.target.value)} /></div>
          <div className="field"><label htmlFor="guardian_occupation">Pekerjaan</label><input id="guardian_occupation" value={form.guardian_occupation || ""} onChange={(e) => set("guardian_occupation", e.target.value)} /></div>
          <div className="field full"><label htmlFor="guardian_address">Alamat</label><input id="guardian_address" value={form.guardian_address || ""} onChange={(e) => set("guardian_address", e.target.value)} /></div>
        </div>

        <h2 style={{ marginTop: 22 }}>3. Data Tambahan &amp; Kesehatan</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="blood_type">Golongan Darah</label><input id="blood_type" placeholder="O+" value={form.blood_type || ""} onChange={(e) => set("blood_type", e.target.value)} /></div>
          <div className="field"><label htmlFor="special_needs">Kebutuhan Khusus</label><input id="special_needs" placeholder="Tidak ada" value={form.special_needs || ""} onChange={(e) => set("special_needs", e.target.value)} /></div>
          <div className="field"><label htmlFor="languages">Bahasa yang Dikuasai</label><input id="languages" value={form.languages || ""} onChange={(e) => set("languages", e.target.value)} /></div>
          <div className="field"><label htmlFor="hobbies">Hobi / Minat</label><input id="hobbies" value={form.hobbies || ""} onChange={(e) => set("hobbies", e.target.value)} /></div>
          <div className="field"><label htmlFor="transport_mode">Transportasi</label><input id="transport_mode" placeholder="Diantar Orang Tua" value={form.transport_mode || ""} onChange={(e) => set("transport_mode", e.target.value)} /></div>
          <div className="field"><label htmlFor="health_notes">Catatan Kesehatan / Alergi</label><input id="health_notes" value={form.health_notes || ""} onChange={(e) => set("health_notes", e.target.value)} /></div>
          <div className="field">
            <label>Perbolehan Foto &amp; Video</label>
            <div className="choice-row">
              {[["true", "Diizinkan"], ["false", "Tidak diizinkan"]].map(([v, label]) => (
                <button type="button" key={v} className={form.photo_consent === v ? "choice selected" : "choice"} onClick={() => set("photo_consent", v)} aria-pressed={form.photo_consent === v}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: 22 }}>4. Konfirmasi Pendaftaran</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="branch_id">Cabang *</label>
            <select id="branch_id" value={form.branch_id || ""} onChange={(e) => set("branch_id", e.target.value)} required>
              <option value="">Pilih cabang</option>
              {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
            {errors.branch_id ? <span className="err">{errors.branch_id}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="program_id">Program *</label>
            <select id="program_id" value={form.program_id || ""} onChange={(e) => set("program_id", e.target.value)} required>
              <option value="">Pilih program</option>
              {meta.programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            {errors.program_id ? <span className="err">{errors.program_id}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="class_id">Kelas yang Dituju *</label>
            <select id="class_id" value={form.class_id || ""} onChange={(e) => set("class_id", e.target.value)} required>
              <option value="">Pilih kelas</option>
              {classesFor.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            {errors.class_id ? <span className="err">{errors.class_id}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="enrolled_on">Tanggal Masuk</label>
            <input id="enrolled_on" type="date" value={form.enrolled_on || ""} onChange={(e) => set("enrolled_on", e.target.value)} />
          </div>
        </div>

        {result ? (
          <p className={result.ok ? "success" : "notice"} role="status" style={{ marginTop: 16 }}>
            {result.message} {result.ok && result.id ? <Link href={`/anak/${result.id}`}>Lihat detail anak</Link> : null}
          </p>
        ) : null}
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn secondary" href="/anak">Batal</Link>
          <button className="btn" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Data Anak"}</button>
        </div>
      </form>
    </>
  );
}
