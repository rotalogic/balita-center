"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, PageHead } from "@/components/chrome";

type Meta = {
  branches: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; branch_id: string; name: string }>;
  staff: Array<{ id: string; branch_id: string; full_name: string; position: string }>;
};
type Child = { id: string; full_name: string; branch_name: string };
type Activity = { title: string; apparatus: string; area: string; rating: string; photo_url: string; activity_time: string; notes: string };
const emptyActivity: Activity = { title: "", apparatus: "", area: "", rating: "5", photo_url: "", activity_time: "", notes: "" };
const LEVELS = ["tidak", "sedikit", "cukup", "banyak"];
const NAP = [["buruk", "Buruk"], ["cukup", "Cukup"], ["baik", "Baik"], ["sangat_baik", "Sangat Baik"]];
const MOODS = [["sedih", "😢 Sedih"], ["cemas", "😟 Cemas"], ["biasa", "😐 Biasa"], ["ceria", "😊 Ceria"], ["sangat_ceria", "😄 Sangat Ceria"]];

export default function BuatDailyReportPage() {
  const [meta, setMeta] = useState<Meta>({ branches: [], classes: [], staff: [] });
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ report_date: new Date().toISOString().slice(0, 10), meal_level: "banyak", snack_level: "banyak", nap_quality: "baik", mood: "ceria" });
  const [activities, setActivities] = useState<Activity[]>([{ ...emptyActivity }]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([""]);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then((d) => (d.ok ? setMeta(d) : setError(d.error))).catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/children").then((r) => r.json()).then((d) => (d.ok ? setChildren(d.children) : null)).catch(() => null);
  }, []);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const classesFor = meta.classes.filter((c) => !form.branch_id || c.branch_id === form.branch_id);
  const staffFor = meta.staff.filter((s) => !form.branch_id || s.branch_id === form.branch_id);
  const teacherName = staffFor.find((s) => s.id === form.created_by)?.full_name || "";
  const childName = children.find((c) => c.id === form.child_id)?.full_name || "";
  const timeline = activities.filter((a) => a.title || a.activity_time).slice().sort((a, b) => (a.activity_time || "99").localeCompare(b.activity_time || "99"));

  const setActivity = (i: number, patch: Partial<Activity>) =>
    setActivities((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  async function submit(submitForReview: boolean) {
    setResult(null);
    if (!form.branch_id || !form.child_id || !form.class_id || !form.created_by) {
      setResult({ ok: false, message: "Cabang, anak, kelas, dan guru pembuat wajib dipilih. Buat data awal dulu bila pilihannya masih kosong." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/daily-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        toilet_pee_count: Number(form.toilet_pee_count || 0),
        toilet_poop_count: Number(form.toilet_poop_count || 0),
        submit: submitForReview,
        activities: activities.filter((a) => a.title).map((a) => ({ ...a, rating: Number(a.rating || 0) })),
        photo_urls: photoUrls.filter(Boolean),
      }),
    });
    const data = await res.json();
    setSaving(false);
    setResult(
      data.ok
        ? { ok: true, message: submitForReview ? "Laporan tersimpan dan terkirim untuk review." : "Draft laporan tersimpan." }
        : { ok: false, message: data.error || "Gagal menyimpan laporan." }
    );
  }

  return (
    <>
      <PageHead title="Buat Daily Report" subtitle="Catat kegiatan, perkembangan, dan kondisi anak didik hari ini" />
      {error ? <ErrorState message={error} /> : null}
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="editor-grid">
          <div className="card">
            <div className="form-grid">
              <div className="field"><label htmlFor="branch_id">Cabang *</label>
                <select id="branch_id" value={form.branch_id || ""} onChange={(e) => set("branch_id", e.target.value)}><option value="">Pilih cabang</option>{meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
              <div className="field"><label htmlFor="child_id">Anak *</label>
                <select id="child_id" value={form.child_id || ""} onChange={(e) => set("child_id", e.target.value)}><option value="">Pilih anak</option>{children.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}</select></div>
              <div className="field"><label htmlFor="class_id">Kelas *</label>
                <select id="class_id" value={form.class_id || ""} onChange={(e) => set("class_id", e.target.value)}><option value="">Pilih kelas</option>{classesFor.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
              <div className="field"><label htmlFor="report_date">Tanggal Laporan *</label>
                <input id="report_date" type="date" value={form.report_date} onChange={(e) => set("report_date", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>1. Makan &amp; Minum</h2>
            <div className="form-grid">
              <div className="field"><label>Tingkat Makan Siang</label><div className="choice-row">{LEVELS.map((l) => (<button type="button" key={l} className={form.meal_level === l ? "choice selected" : "choice"} onClick={() => set("meal_level", l)} aria-pressed={form.meal_level === l} style={{ textTransform: "capitalize" }}>{l}</button>))}</div></div>
              <div className="field"><label>Tingkat Snack</label><div className="choice-row">{LEVELS.map((l) => (<button type="button" key={l} className={form.snack_level === l ? "choice selected" : "choice"} onClick={() => set("snack_level", l)} aria-pressed={form.snack_level === l} style={{ textTransform: "capitalize" }}>{l}</button>))}</div></div>
              <div className="field"><label htmlFor="meals_text">Menu Makan Siang</label><input id="meals_text" placeholder="Nasi, ayam, sayur" value={form.meals_text || ""} onChange={(e) => set("meals_text", e.target.value)} /></div>
              <div className="field"><label htmlFor="snack_text">Menu Snack</label><input id="snack_text" placeholder="Buah, susu" value={form.snack_text || ""} onChange={(e) => set("snack_text", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>2. Tidur &amp; Istirahat</h2>
            <div className="form-grid">
              <div className="field"><label>Kualitas Tidur</label><div className="choice-row">{NAP.map(([v, label]) => (<button type="button" key={v} className={form.nap_quality === v ? "choice selected" : "choice"} onClick={() => set("nap_quality", v)} aria-pressed={form.nap_quality === v}>{label}</button>))}</div></div>
              <div className="field"><label>Jam Tidur</label><div className="row"><input type="time" aria-label="Mulai tidur" value={form.nap_start || ""} onChange={(e) => set("nap_start", e.target.value)} /><input type="time" aria-label="Selesai tidur" value={form.nap_end || ""} onChange={(e) => set("nap_end", e.target.value)} /></div></div>
            </div>

            <h2 style={{ marginTop: 22 }}>3. Toilet Training</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="pee">Pipis (kali)</label><input id="pee" type="number" min="0" value={form.toilet_pee_count || "0"} onChange={(e) => set("toilet_pee_count", e.target.value)} /></div>
              <div className="field"><label htmlFor="poop">BAB (kali)</label><input id="poop" type="number" min="0" value={form.toilet_poop_count || "0"} onChange={(e) => set("toilet_poop_count", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>4. Mood &amp; Perilaku</h2>
            <div className="form-grid">
              <div className="field"><label>Mood Hari Ini</label><div className="choice-row">{MOODS.map(([v, label]) => (<button type="button" key={v} className={form.mood === v ? "choice selected" : "choice"} onClick={() => set("mood", v)} aria-pressed={form.mood === v}>{label}</button>))}</div></div>
              <div className="field"><label htmlFor="mood_notes">Catatan Perilaku</label><input id="mood_notes" value={form.mood_notes || ""} onChange={(e) => set("mood_notes", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>5. Aktivitas &amp; Pembelajaran</h2>
            {activities.map((a, i) => (
              <div className="activity-row" key={i}>
                <div className="row spread"><strong>Aktivitas {i + 1}</strong>{activities.length > 1 ? <button type="button" className="btn small danger" onClick={() => setActivities(activities.filter((_, idx) => idx !== i))}>Hapus</button> : null}</div>
                <div className="form-grid" style={{ marginTop: 8 }}>
                  <div className="field"><label>Judul Aktivitas</label><input placeholder="Mengenal warna dan bentuk" value={a.title} onChange={(e) => setActivity(i, { title: e.target.value })} /></div>
                  <div className="field"><label>Jam</label><input type="time" value={a.activity_time} onChange={(e) => setActivity(i, { activity_time: e.target.value })} /></div>
                  <div className="field"><label>Aparatus (syarat terbit)</label><input placeholder="Kartu warna Montessori" value={a.apparatus} onChange={(e) => setActivity(i, { apparatus: e.target.value })} /></div>
                  <div className="field"><label>Rating 1-5 (syarat terbit)</label><input type="number" min="1" max="5" value={a.rating} onChange={(e) => setActivity(i, { rating: e.target.value })} /></div>
                  <div className="field"><label>URL Foto Aktivitas</label><input placeholder="https://..." value={a.photo_url} onChange={(e) => setActivity(i, { photo_url: e.target.value })} /></div>
                  <div className="field"><label>Catatan Aktivitas</label><input value={a.notes} onChange={(e) => setActivity(i, { notes: e.target.value })} /></div>
                </div>
              </div>
            ))}
            <button type="button" className="btn secondary small" onClick={() => setActivities([...activities, { ...emptyActivity }])}>+ Tambah Aktivitas</button>

            <h2 style={{ marginTop: 22 }}>6. Foto &amp; Video</h2>
            {photoUrls.map((url, i) => (
              <div className="field" key={i} style={{ marginBottom: 8 }}>
                <label>URL Foto Galeri {i + 1}</label>
                <input placeholder="https://..." value={url} onChange={(e) => setPhotoUrls(photoUrls.map((u, idx) => (idx === i ? e.target.value : u)))} />
              </div>
            ))}
            <button type="button" className="btn secondary small" onClick={() => setPhotoUrls([...photoUrls, ""])}>+ Tambah Foto</button>
            <p className="hint muted">Unggah berkas sungguhan memerlukan storage (S3/R2) yang belum dikonfigurasi di paket ini; dokumentasi dicatat sebagai URL media.</p>

            <h2 style={{ marginTop: 22 }}>7. Catatan Tambahan</h2>
            <div className="field"><label htmlFor="notes">Catatan Guru</label><textarea id="notes" rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>

            {result ? <p className={result.ok ? "success" : "notice"} role="status" style={{ marginTop: 16 }}>{result.message} {result.ok ? <Link href="/daily-reports">Lihat daftar laporan</Link> : null}</p> : null}
            <div className="row" style={{ marginTop: 18 }}>
              <Link className="btn secondary" href="/daily-reports">Batal</Link>
              <button type="button" className="btn secondary" disabled={saving} onClick={() => submit(false)}>Simpan sebagai Draft</button>
              <button type="button" className="btn" disabled={saving} onClick={() => submit(true)}>{saving ? "Menyimpan..." : "Simpan & Kirim untuk Review"}</button>
            </div>
          </div>

          <aside>
            <div className="card">
              <h2>Timeline Hari Ini</h2>
              {timeline.length === 0 ? (
                <p className="muted">Isi jam dan judul aktivitas, urutan hari ini tampil di sini seperti di gambar acuan.</p>
              ) : (
                <ul className="timeline">
                  {timeline.map((a, i) => (
                    <li key={i}><time>{a.activity_time || "--:--"}</time><div><strong>{a.title || "(aktivitas)"}</strong><div className="muted">{a.apparatus}</div></div></li>
                  ))}
                </ul>
              )}
              <h3 style={{ marginTop: 16 }}>Ringkasan</h3>
              <p className="muted" style={{ margin: 0 }}>
                Anak: <strong>{childName || "-"}</strong><br />
                Tanggal: {form.report_date}<br />
                Mood: {MOODS.find(([v]) => v === form.mood)?.[1] || "-"}<br />
                Aktivitas terisi: {activities.filter((a) => a.title).length} · Foto galeri: {photoUrls.filter(Boolean).length}
              </p>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Guru &amp; Fasilitator</h2>
              <div className="field"><label htmlFor="created_by">Guru Pembuat *</label>
                <select id="created_by" value={form.created_by || ""} onChange={(e) => set("created_by", e.target.value)}><option value="">Pilih guru</option>{staffFor.map((s) => (<option key={s.id} value={s.id}>{s.full_name} · {s.position}</option>))}</select></div>
              <div className="field" style={{ marginTop: 10 }}><label htmlFor="lead_facilitator_id">Fasilitator Utama (syarat terbit)</label>
                <select id="lead_facilitator_id" value={form.lead_facilitator_id || ""} onChange={(e) => set("lead_facilitator_id", e.target.value)}><option value="">Belum dipilih</option>{staffFor.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}</select></div>
              <h3 style={{ marginTop: 16 }}>Tanda Tangan Guru</h3>
              <div className="signature" aria-label="Tanda tangan guru pembuat">{teacherName || "Nama guru pembuat"}</div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{teacherName || "Pilih guru pembuat untuk menandatangani laporan ini."}</p>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
