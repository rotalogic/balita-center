"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";

type Anak = {
  id: string; full_name: string; nickname: string | null; birth_date: string | null;
  gender: string | null; blood_type: string | null; status: string | null;
  health_notes: string | null; special_needs: string | null; languages: string | null;
  hobbies: string | null; transport_mode: string | null;
};

// Formulir ubah data anak — memakai field yang sama dengan wizard tambah anak.
export default function UbahAnak({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<Anak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/children/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const c = (d.child || d.data || {}) as Anak;
          setForm(c);
        } else {
          setError(d.error || "Data anak tidak ditemukan.");
        }
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  const set = (k: keyof Anak, v: string) => setForm((p) => (p ? { ...p, [k]: v } : p));

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setPesan(null);
    const res = await fetch(`/api/children/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) {
      setPesan(d.berubah ? `Tersimpan. ${d.berubah} kolom diperbarui.` : "Tidak ada perubahan.");
      router.refresh();
    } else {
      setError(d.error || "Gagal menyimpan.");
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!form) return <LoadingState />;

  return (
    <>
      <PageHead title={`Ubah Data — ${form.full_name}`} subtitle="Perubahan tercatat di Jejak Audit." />
      {pesan ? <p className="notice">{pesan}</p> : null}
      <form className="card" onSubmit={simpan}>
        <div className="form-grid">
          <div className="field"><label htmlFor="full_name">Nama Lengkap</label>
            <input id="full_name" value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} required /></div>
          <div className="field"><label htmlFor="nickname">Nama Panggilan</label>
            <input id="nickname" value={form.nickname || ""} onChange={(e) => set("nickname", e.target.value)} /></div>
          <div className="field"><label htmlFor="birth_date">Tanggal Lahir</label>
            <input id="birth_date" type="date" value={(form.birth_date || "").slice(0, 10)} onChange={(e) => set("birth_date", e.target.value)} /></div>
          <div className="field"><label htmlFor="gender">Jenis Kelamin</label>
            <select id="gender" value={form.gender || ""} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Belum diisi</option>
              <option value="perempuan">Perempuan</option>
              <option value="laki_laki">Laki-laki</option>
            </select></div>
          <div className="field"><label htmlFor="blood_type">Golongan Darah</label>
            <select id="blood_type" value={form.blood_type || ""} onChange={(e) => set("blood_type", e.target.value)}>
              <option value="">Belum diisi</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (<option key={g} value={g}>{g}</option>))}
            </select></div>
          <div className="field"><label htmlFor="status">Status</label>
            <select id="status" value={form.status || "aktif"} onChange={(e) => set("status", e.target.value)}>
              <option value="aktif">Aktif</option>
              <option value="cuti">Cuti</option>
              <option value="lulus">Lulus</option>
              <option value="berhenti">Berhenti</option>
            </select></div>
          <div className="field"><label htmlFor="health_notes">Catatan Kesehatan / Alergi</label>
            <input id="health_notes" value={form.health_notes || ""} onChange={(e) => set("health_notes", e.target.value)} /></div>
          <div className="field"><label htmlFor="special_needs">Kebutuhan Khusus</label>
            <input id="special_needs" value={form.special_needs || ""} onChange={(e) => set("special_needs", e.target.value)} /></div>
          <div className="field"><label htmlFor="languages">Bahasa</label>
            <input id="languages" value={form.languages || ""} onChange={(e) => set("languages", e.target.value)} /></div>
          <div className="field"><label htmlFor="hobbies">Hobi / Minat</label>
            <input id="hobbies" value={form.hobbies || ""} onChange={(e) => set("hobbies", e.target.value)} /></div>
          <div className="field"><label htmlFor="transport_mode">Transportasi</label>
            <input id="transport_mode" value={form.transport_mode || ""} onChange={(e) => set("transport_mode", e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Perubahan"}</button>
          <a className="btn secondary" href={`/anak/${params.id}`}>Batal</a>
        </div>
      </form>
    </>
  );
}
