"use client";

import { tanggalPanjang } from "@/lib/format";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ErrorState, PageHead } from "@/components/chrome";
import { TimeInput } from "@/components/time-input";
import { buatPosterVideo, useUpload } from "@/components/upload";
import { SyaratChecklist, cekSyaratLokal } from "@/components/syarat-checklist";
import { SEGMEN_ZKC } from "@/lib/segmen";

type Meta = {
  branches: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; branch_id: string; name: string }>;
  staff: Array<{ id: string; branch_id: string; full_name: string; position: string }>;
  materials: Array<{ id: string; name: string; name_en: string | null; area: string; age_group: string | null }>;
  milestones: Array<{ id: string; indikator: string; age_group: string; aspect: string; montessori_area: string | null; status: string }>;
  materialMilestones: Array<{ material_id: string; milestone_id: string }>;
};
type Child = { id: string; full_name: string; branch_name: string };
type GaleriItem = { url: string; media_type: "image" | "video"; mime_type?: string; poster_url?: string };
type Activity = { title: string; apparatus: string; area: string; rating: string; photo_url: string; activity_time: string; notes: string; work_location: string; work_mode: string; material_id: string; milestone_id: string };
const emptyActivity: Activity = { title: "", apparatus: "", area: "", rating: "", photo_url: "", activity_time: "", notes: "", work_location: "", work_mode: "", material_id: "", milestone_id: "" };
const AREA_OPSI = [["practical_life", "Practical Life"], ["language", "Language"], ["sensorial", "Sensorial"], ["mathematics", "Mathematics"], ["cultural", "Cultural"], ["observasi", "Observasi"]];
const LOKASI_OPSI = [["lantai", "Lantai"], ["meja", "Meja"], ["alas", "Alas Kerja"]];
const MODE_OPSI = [["sendiri", "Sendiri"], ["berpasangan", "Berpasangan"], ["kelompok_kecil", "Kelompok Kecil"], ["kelompok_besar", "Kelompok Besar"]];
const LEVELS = ["tidak", "sedikit", "cukup", "banyak"];
const NAP = [["buruk", "Buruk"], ["cukup", "Cukup"], ["baik", "Baik"], ["sangat_baik", "Sangat Baik"]];
const MOODS = [["sedih", "😢 Sedih"], ["cemas", "😟 Cemas"], ["biasa", "😐 Biasa"], ["ceria", "😊 Ceria"], ["sangat_ceria", "😄 Sangat Ceria"]];

export default function BuatDailyReportPage() {
  const [meta, setMeta] = useState<Meta>({ branches: [], classes: [], staff: [], materials: [], milestones: [], materialMilestones: [] });
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ report_date: new Date().toISOString().slice(0, 10), meal_level: "banyak", snack_level: "banyak", nap_quality: "baik", mood: "ceria" });
  const [activities, setActivities] = useState<Activity[]>([{ ...emptyActivity }]);
  const [segmen, setSegmen] = useState<Record<string, string>>({});
  const [gallery, setGallery] = useState<GaleriItem[]>([]);
  const photoUrls = gallery.map((g) => g.url);
  const [result, setResult] = useState<{ ok: boolean; message: string; existingId?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [reportId, setReportId] = useState<string | null>(null);
  // Blok 1C: form tidak boleh bisa diisi sebelum data draft selesai dimuat,
  // supaya isi tersimpan tidak tertimpa form kosong.
  const [siap, setSiap] = useState(false);
  const upload = useUpload();
  const [dipulihkan, setDipulihkan] = useState(false);
  const [simpanTerakhir, setSimpanTerakhir] = useState<string | null>(null);
  const [statusLaporan, setStatusLaporan] = useState<string>("");
  const kunciDraf = `bc-draf-${reportId ?? "baru"}`;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");

    const metaTask = fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => (d.ok ? setMeta(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    const childTask = fetch("/api/children")
      .then((r) => r.json())
      .then((d) => (d.ok ? setChildren(d.children) : null))
      .catch(() => null);

    if (!id) {
      void Promise.all([metaTask, childTask]).then(() => setSiap(true));
      return;
    }

    setReportId(id);
    const reportTask = fetch(`/api/daily-reports/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "Laporan tidak bisa dimuat.");
          return;
        }
        const r = d.report as Record<string, unknown>;
        setStatusLaporan(String(r.status ?? ""));
        const jam = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : "");
        // Setiap field diisi dari respons server — termasuk yang kosong — lalu
        // form baru dibuka. Tidak ada jendela waktu untuk menimpa data.
        setForm({
          branch_id: String(r.branch_id ?? ""),
          child_id: String(r.child_id ?? ""),
          class_id: String(r.class_id ?? ""),
          created_by: String(r.created_by ?? ""),
          lead_facilitator_id: String(r.lead_facilitator_id ?? ""),
          report_date: String(r.report_date ?? "").slice(0, 10),
          meals_text: String(r.meals_text ?? ""),
          snack_text: String(r.snack_text ?? ""),
          meal_level: String(r.meal_level ?? ""),
          snack_level: String(r.snack_level ?? ""),
          nap_quality: String(r.nap_quality ?? ""),
          nap_start: jam(r.nap_start),
          nap_end: jam(r.nap_end),
          toilet_pee_count: String(r.toilet_pee_count ?? 0),
          toilet_poop_count: String(r.toilet_poop_count ?? 0),
          mood: String(r.mood ?? ""),
          mood_notes: String(r.mood_notes ?? ""),
          notes: String(r.notes ?? ""),
          circle_theme: String(r.circle_theme ?? ""),
          circle_rating: String(r.circle_rating ?? ""),
          circle_notes: String(r.circle_notes ?? ""),
          special_moment: String(r.special_moment ?? ""),
          home_suggestion: String(r.home_suggestion ?? ""),
        });
        const rows = (d.activities || []) as Array<Record<string, unknown>>;
        setActivities(
          rows.length > 0
            ? rows.map((a) => ({
                title: String(a.title ?? ""),
                apparatus: String(a.apparatus ?? ""),
                area: String(a.area ?? ""),
                rating: String(a.rating ?? ""),
                photo_url: String(a.photo_url ?? ""),
                activity_time: jam(a.activity_time),
                notes: String(a.notes ?? ""),
                work_location: String(a.work_location ?? ""),
                work_mode: String(a.work_mode ?? ""),
                material_id: String(a.material_id ?? ""),
                milestone_id: String(a.milestone_id ?? ""),
              }))
            : [{ ...emptyActivity }]
        );
        const seg: Record<string, string> = {};
        for (const s of (d.segments || []) as Array<Record<string, unknown>>) {
          seg[String(s.segmen)] = String(s.catatan ?? "");
        }
        setSegmen(seg);
        const galeri = ((d.photos || []) as Array<Record<string, unknown>>).map((p) => ({
          url: String(p.photo_url ?? ""),
          media_type: (p.media_type === "video" ? "video" : "image") as "image" | "video",
          mime_type: p.mime_type ? String(p.mime_type) : undefined,
          poster_url: p.poster_url ? String(p.poster_url) : undefined,
        })).filter((g) => g.url);
        setGallery(galeri);
      })
      .catch(() => setError("Laporan tidak bisa dimuat."));

    void Promise.all([metaTask, childTask, reportTask]).then(() => setSiap(true));
  }, []);

  // Simpanan lokal: bila sesi putus di tengah pengisian, isi terakhir tidak hilang.
  useEffect(() => {
    if (!siap) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(kunciDraf, JSON.stringify({ form, activities, gallery, segmen }));
        setSimpanTerakhir(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        /* kuota penuh: abaikan, jangan ganggu pengisian */
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form, activities, gallery, segmen, siap, kunciDraf]);

  // Pulihkan simpanan lokal setelah data server selesai dimuat.
  useEffect(() => {
    if (!siap) return;
    try {
      const simpan = localStorage.getItem(kunciDraf);
      if (!simpan) return;
      const isi = JSON.parse(simpan) as { form?: Record<string, string>; activities?: typeof activities; gallery?: GaleriItem[]; photoUrls?: string[]; segmen?: Record<string, string> };
      if (isi.form) setForm((p) => ({ ...p, ...isi.form }));
      if (isi.segmen) setSegmen(isi.segmen);
      if (isi.activities?.length) setActivities(isi.activities.map((x) => ({ ...emptyActivity, ...x })));
      if (isi.gallery?.length) setGallery(isi.gallery);
      else if (isi.photoUrls?.length) setGallery(isi.photoUrls.filter(Boolean).map((url) => ({ url, media_type: "image" as const })));
      setDipulihkan(true);
    } catch {
      /* simpanan rusak: abaikan */
    }
  }, [siap, kunciDraf]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const classesFor = meta.classes.filter((c) => !form.branch_id || c.branch_id === form.branch_id);
  const staffFor = meta.staff.filter((s) => !form.branch_id || s.branch_id === form.branch_id);
  const teacherName = staffFor.find((s) => s.id === form.created_by)?.full_name || "";
  const childName = children.find((c) => c.id === form.child_id)?.full_name || "";
  const timeline = activities.filter((a) => a.title || a.activity_time).slice().sort((a, b) => (a.activity_time || "99").localeCompare(b.activity_time || "99"));

  const syarat = useMemo(
    () => cekSyaratLokal({ lead_facilitator_id: form.lead_facilitator_id, activities, photoUrls }),
    [form.lead_facilitator_id, activities, photoUrls]
  );

  const setActivity = (i: number, patch: Partial<Activity>) =>
    setActivities((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  // Pemilih katalog: material mengikuti area aktivitas; milestone diprioritaskan
  // dari pemetaan material, lalu area Montessori, terakhir seluruh katalog.
  const materialTersedia = (a: Activity) => (a.area ? meta.materials.filter((m) => m.area === a.area) : meta.materials);
  const milestoneTerkait = (a: Activity) =>
    a.material_id ? meta.materialMilestones.filter((mm) => mm.material_id === a.material_id).map((mm) => mm.milestone_id) : [];
  const milestoneTersedia = (a: Activity) => {
    const terkait = milestoneTerkait(a);
    if (terkait.length > 0) return meta.milestones.filter((m) => terkait.includes(m.id));
    if (a.area && a.area !== "observasi") {
      const searea = meta.milestones.filter((m) => m.montessori_area === a.area);
      if (searea.length > 0) return searea;
    }
    return meta.milestones;
  };
  const pilihMaterial = (i: number, id: string) => {
    if (!id) { setActivity(i, { material_id: "" }); return; }
    const m = meta.materials.find((x) => x.id === id);
    if (!m) return;
    const a = activities[i];
    const terkait = meta.materialMilestones.filter((mm) => mm.material_id === id).map((mm) => mm.milestone_id);
    setActivity(i, {
      material_id: id,
      apparatus: m.name,
      area: m.area,
      milestone_id: a.milestone_id && (terkait.length === 0 || terkait.includes(a.milestone_id)) ? a.milestone_id : "",
    });
  };
  const ketikAparatus = (i: number, v: string) => {
    const a = activities[i];
    const m = meta.materials.find((x) => x.id === a.material_id);
    setActivity(i, { apparatus: v, material_id: m && m.name === v ? a.material_id : "" });
  };
  const gantiArea = (i: number, v: string) => {
    const a = activities[i];
    const m = meta.materials.find((x) => x.id === a.material_id);
    setActivity(i, { area: v, material_id: m && m.area === v ? a.material_id : "" });
  };

  async function unggahFoto(files: FileList | null, target: { kind: "galeri" } | { kind: "aktivitas"; index: number }) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const video = file.type.startsWith("video/");
      if (video && target.kind === "aktivitas") {
        upload.setError("Foto aktivitas hanya gambar. Video masuk lewat galeri Foto & Video di bawah.");
        return;
      }
      const hasil = await upload.unggah(file);
      if (!hasil) return;
      if (target.kind === "aktivitas") {
        setActivity(target.index, { photo_url: hasil.url });
        continue;
      }
      let posterUrl: string | undefined;
      if (video) {
        // Poster diambil dari frame awal di peramban; kegagalan poster tidak
        // menggagalkan videonya — PDF akan memakai kotak penanda video.
        const poster = await buatPosterVideo(file);
        if (poster) {
          const naik = await upload.unggah(poster);
          if (naik) posterUrl = naik.url;
        }
      }
      setGallery((prev) => [...prev, { url: hasil.url, media_type: hasil.media_type, mime_type: hasil.mime_type, poster_url: posterUrl }]);
    }
  }

  async function submit(submitForReview: boolean) {
    setResult(null);
    if (!form.branch_id || !form.child_id || !form.class_id || !form.created_by) {
      setResult({ ok: false, message: "Cabang, anak, kelas, dan guru pembuat wajib dipilih. Buat data awal dulu bila pilihannya masih kosong." });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      toilet_pee_count: Number(form.toilet_pee_count || 0),
      toilet_poop_count: Number(form.toilet_poop_count || 0),
      submit: submitForReview,
      circle_rating: Number(form.circle_rating || 0),
      activities: activities.filter((a) => a.title).map((a) => ({ ...a, rating: Number(a.rating || 0) })),
      photos: gallery.map((g) => ({ photo_url: g.url, media_type: g.media_type, mime_type: g.mime_type, poster_url: g.poster_url })),
      segmen,
    };
    try {
      const res = reportId
        ? await fetch(`/api/daily-reports/${reportId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/daily-reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.status === 401) {
        // Sesi berakhir: isi sudah aman di simpanan lokal, kembali ke editor setelah login.
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      const data = await res.json();

      if (data.ok) {
        try {
          localStorage.removeItem(kunciDraf);
        } catch {
          /* abaikan */
        }
      }

      if (data.ok) {
        if (data.status === "menunggu_review") {
          setResult({ ok: true, message: "Laporan tersimpan dan terkirim untuk review." });
          window.location.href = `/daily-reports/${reportId || data.id}`;
          return;
        }
        if (reportId) {
          window.location.href = `/daily-reports/${reportId}`;
          return;
        }
        // Laporan baru: simpan id supaya klik berikutnya memperbarui, bukan menggandakan.
        setReportId(data.id);
        setResult({ ok: true, message: "Draft laporan tersimpan. Buka daftar untuk mengirimnya ke review." });
        return;
      }

      const kurang: string[] = Array.isArray(data.kurang) ? data.kurang : [];
      setResult({
        ok: false,
        message: [data.error || "Gagal menyimpan laporan.", ...kurang.map((k) => `• ${k}`)].join("\n"),
        existingId: typeof data.existing_id === "string" ? data.existing_id : undefined,
      });
    } catch {
      setResult({ ok: false, message: "Koneksi terputus. Laporan belum tersimpan — coba lagi." });
    } finally {
      setSaving(false);
    }
  }

  if (!siap) {
    return (
      <>
        <PageHead title={reportId ? "Edit Daily Report" : "Buat Daily Report"} subtitle="Memuat data laporan…" />
        <div className="card" aria-busy="true">
          <p className="muted">Memuat data laporan…</p>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 16, borderRadius: 4, background: "#eceff3", margin: "10px 0", width: `${70 - i * 8}%` }} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={reportId ? "Edit Daily Report" : "Buat Daily Report"}
        subtitle={reportId ? "Perbaiki isi draft/revisi lalu simpan atau kirim untuk review" : "Catat kegiatan, perkembangan, dan kondisi anak didik hari ini"}
        action={
          <span className="muted" aria-live="polite" style={{ fontSize: 12 }}>
            {simpanTerakhir ? `Tersimpan di perangkat pukul ${simpanTerakhir}` : "Menyimpan…"}
          </span>
        }
      />
      {dipulihkan ? (
        <p className="notice" role="status">Isi terakhir dipulihkan dari simpanan di perangkat ini.</p>
      ) : null}
      {statusLaporan === "menunggu_review" ? (
        <p className="notice" role="status">
          Laporan ini sedang menunggu review. Guru masih boleh memperbaiki isinya — setiap perubahan tercatat di Jejak Audit.
        </p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      {dipulihkan ? (
        <p className="notice" role="status">Isi terakhir dipulihkan dari simpanan di perangkat ini (sesi sempat terputus).</p>
      ) : null}
      {upload.error ? <div className="alert alert-error" role="alert">{upload.error}</div> : null}
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
              <div className="field"><label>Jam Tidur</label><div className="row"><TimeInput label="Mulai tidur" value={form.nap_start || ""} onChange={(v) => set("nap_start", v)} /><TimeInput label="Selesai tidur" value={form.nap_end || ""} onChange={(v) => set("nap_end", v)} /></div></div>
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
                  <div className="field"><label>Jam</label><TimeInput value={a.activity_time} label={`Jam aktivitas ${i + 1}`} onChange={(v) => setActivity(i, { activity_time: v })} /></div>
                  <div className="field"><label>Aparatus (syarat terbit)</label><input placeholder="Kartu warna Montessori" value={a.apparatus} onChange={(e) => ketikAparatus(i, e.target.value)} /></div>
                  <div className="field"><label>Penilaian Kata (syarat terbit)</label><select value={a.rating} onChange={(e) => setActivity(i, { rating: e.target.value })}><option value="">Belum dinilai</option><option value="1">Belum Mampu</option><option value="2">Mulai Mampu</option><option value="3">Mandiri</option></select></div>
                  <div className="field"><label>Area Montessori</label><select value={a.area} onChange={(e) => gantiArea(i, e.target.value)}><option value="">Pilih area</option>{AREA_OPSI.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}</select></div>
                  <div className="field"><label>Lokasi Kerja</label><select value={a.work_location} onChange={(e) => setActivity(i, { work_location: e.target.value })}><option value="">Pilih lokasi</option>{LOKASI_OPSI.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}</select></div>
                  <div className="field"><label>Mode Kerja</label><select value={a.work_mode} onChange={(e) => setActivity(i, { work_mode: e.target.value })}><option value="">Pilih mode</option>{MODE_OPSI.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}</select></div>
                  <div className="field"><label>Material — Katalog AMI</label>
                    <select value={a.material_id} onChange={(e) => pilihMaterial(i, e.target.value)}>
                      <option value="">Ketik bebas (tanpa katalog)</option>
                      {materialTersedia(a).map((m) => (<option key={m.id} value={m.id}>{m.name}{m.age_group ? ` · usia ${m.age_group}` : ""}</option>))}
                    </select>
                    {a.material_id && milestoneTerkait(a).length > 0 ? <small className="muted">Material ini terhubung ke {milestoneTerkait(a).length} milestone di kolom sebelah.</small> : null}
                  </div>
                  <div className="field"><label>Milestone Perkembangan</label>
                    <select value={a.milestone_id} onChange={(e) => setActivity(i, { milestone_id: e.target.value })}>
                      <option value="">Tidak diamati khusus</option>
                      {milestoneTersedia(a).map((m) => (<option key={m.id} value={m.id}>{m.indikator} · usia {m.age_group}{m.status === "draf" ? " (draf)" : ""}</option>))}
                    </select>
                    {a.milestone_id ? <small className="muted">Penilaian kata aktivitas ini tercatat sebagai tingkat capaian milestone di riwayat perkembangan anak.</small> : null}
                  </div>
                  <div className="field">
                    <label>Foto Aktivitas</label>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void unggahFoto(e.target.files, { kind: "aktivitas", index: i })} />
                    {a.photo_url ? (
                      <a href={a.photo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Lihat foto</a>
                    ) : null}
                  </div>
                  <div className="field"><label>Catatan Aktivitas</label><input value={a.notes} onChange={(e) => setActivity(i, { notes: e.target.value })} /></div>
                </div>
              </div>
            ))}
            <button type="button" className="btn secondary small" onClick={() => setActivities([...activities, { ...emptyActivity }])}>+ Tambah Aktivitas</button>

            <h2 style={{ marginTop: 22 }}>6. Circle Time</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="circle_theme">Tema Circle Time</label><input id="circle_theme" placeholder="Profesi dan Cita-cita" value={form.circle_theme || ""} onChange={(e) => set("circle_theme", e.target.value)} /></div>
              <div className="field"><label htmlFor="circle_rating">Penilaian Circle Time (kata)</label><select id="circle_rating" value={form.circle_rating || ""} onChange={(e) => set("circle_rating", e.target.value)}><option value="">Belum dinilai</option><option value="1">Belum Mampu</option><option value="2">Mulai Mampu</option><option value="3">Mandiri</option></select></div>
              <div className="field"><label htmlFor="circle_notes">Catatan Circle Time</label><input id="circle_notes" value={form.circle_notes || ""} onChange={(e) => set("circle_notes", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>Segmen Sesi ZKC — 9 Segmen Resmi</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Laporan harian Ziel Kids Club ditulis per sembilan segmen sesi yang berurutan (60 menit reguler,
              90 menit Kelas Movement). Isi segmen yang dijalani hari ini; segmen kosong tidak tampil di laporan.
              Untuk anak SAM, isi catatan work cycle lewat Aktivitas &amp; Material di atas.
            </p>
            <div className="form-grid">
              {SEGMEN_ZKC.map((s) => (
                <div className="field" key={s.kunci}>
                  <label htmlFor={`seg_${s.kunci}`}>{s.label}</label>
                  <textarea
                    id={`seg_${s.kunci}`}
                    rows={2}
                    placeholder={s.petunjuk}
                    value={segmen[s.kunci] || ""}
                    onChange={(e) => setSegmen((p) => ({ ...p, [s.kunci]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <h2 style={{ marginTop: 22 }}>7. Moment Special &amp; Saran di Rumah</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="special_moment">Moment Special</label><textarea id="special_moment" rows={2} placeholder="Kosongkan bila tidak ada kejadian spesifik hari ini" value={form.special_moment || ""} onChange={(e) => set("special_moment", e.target.value)} /></div>
              <div className="field"><label htmlFor="home_suggestion">Saran di Rumah</label><textarea id="home_suggestion" rows={2} value={form.home_suggestion || ""} onChange={(e) => set("home_suggestion", e.target.value)} /></div>
            </div>

            <h2 style={{ marginTop: 22 }}>8. Foto &amp; Video</h2>
            <div className="field">
              <label htmlFor="foto-galeri">Unggah foto atau video (JPG/PNG/WEBP maks 5 MB · MP4/WebM maks 50 MB)</label>
              <input id="foto-galeri" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={upload.uploading} onChange={(e) => void unggahFoto(e.target.files, { kind: "galeri" })} />
              {upload.uploading ? <span className="muted" style={{ fontSize: 12 }}>Mengunggah…</span> : null}
              {upload.error ? <p className="error" role="alert" style={{ fontSize: 13 }}>{upload.error}</p> : null}
            </div>
            {gallery.length === 0 ? (
              <p className="muted">Belum ada foto atau video.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {gallery.map((g, i) => (
                  <li key={`${g.url}-${i}`} style={{ border: "1px solid #e3e7ee", borderRadius: 8, padding: 6 }}>
                    {g.media_type === "video" ? (
                      <video src={g.url} poster={g.poster_url} controls preload="metadata" width={144} height={96} style={{ objectFit: "cover", borderRadius: 4, display: "block", background: "#000" }} />
                    ) : (
                      <a href={g.url} target="_blank" rel="noreferrer">
                        <img src={g.url} alt={`Foto ${i + 1}`} width={96} height={96} style={{ objectFit: "cover", borderRadius: 4, display: "block" }} />
                      </a>
                    )}
                    <button type="button" className="btn small danger" style={{ marginTop: 6, width: "100%" }} onClick={() => setGallery((prev) => prev.filter((_, idx) => idx !== i))}>
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h2 style={{ marginTop: 22 }}>9. Catatan Tambahan</h2>
            <div className="field"><label htmlFor="notes">Catatan Guru</label><textarea id="notes" rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>

            {result ? <p className={result.ok ? "success" : "notice"} role="status" style={{ marginTop: 16, whiteSpace: "pre-line" }}>{result.message} {result.ok ? <Link href="/daily-reports">Lihat daftar laporan</Link> : null}{result.existingId ? <> · <Link href={`/daily-reports/${result.existingId}`}>Buka laporan itu</Link></> : null}</p> : null}
            <div className="row" style={{ marginTop: 18 }}>
              <Link className="btn secondary" href="/daily-reports">Batal</Link>
              <button type="button" className="btn secondary" disabled={saving || upload.uploading || !siap} onClick={() => submit(false)}>Simpan sebagai Draft</button>
              <button type="button" className="btn" disabled={saving || upload.uploading || !siap} onClick={() => submit(true)}>{saving ? "Menyimpan…" : "Simpan & Kirim untuk Review"}</button>
            </div>
            {!syarat.ok && !saving ? (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Syarat terbit belum lengkap — tombol kirim akan menampilkan daftar kekurangannya.
              </p>
            ) : null}
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
                Tanggal: {form.report_date ? tanggalPanjang(form.report_date) : "-"}<br />
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
            <SyaratChecklist state={syarat.state} />
          </aside>
        </div>
      </form>
    </>
  );
}
