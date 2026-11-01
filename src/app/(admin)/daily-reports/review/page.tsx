"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Report = {
  id: string;
  report_date: string;
  status: string;
  mood: string | null;
  meal_level: string | null;
  notes: string | null;
  child_name: string;
  class_name: string;
  teacher_name: string;
  facilitator_name: string | null;
  photo_count: string;
  activity_count: string;
};
type Staff = { id: string; full_name: string; position: string };

export default function ReviewPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    fetch("/api/daily-reports?status=menunggu_review")
      .then((r) => r.json())
      .then((d) => (d.ok ? setReports(d.reports) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStaff(d.staff);
          if (d.staff.length > 0) setReviewer((prev) => prev || d.staff[0].id);
        }
      })
      .catch(() => null);
  };
  useEffect(load, []);

  async function act(report: Report, action: "setujui" | "revisi" | "terbitkan") {
    if (!reviewer) {
      setFeedback({ [report.id]: "Pilih reviewer dulu." });
      return;
    }
    setBusy(report.id + action);
    const res = await fetch(`/api/daily-reports/${report.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewer_id: reviewer, notes: notes[report.id] || undefined }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.ok) {
      setFeedback({ [report.id]: `Berhasil: laporan kini berstatus ${data.status.replace(/_/g, " ")}.` });
      load();
    } else {
      // Pesan penolakan trigger database (syarat terbit belum lengkap) tampil apa adanya.
      setFeedback({ [report.id]: data.error || "Aksi gagal." });
    }
  }

  return (
    <>
      <PageHead title="Review & Approval Daily Report" subtitle="Tinjau laporan harian dari guru sebelum diteruskan ke orang tua" />
      <div className="toolbar card">
        <label className="field">
          <span className="muted">Reviewer</span>
          <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} aria-label="Pilih reviewer">
            <option value="">Pilih staf reviewer</option>
            {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name} · {s.position}</option>))}
          </select>
        </label>
        {reports ? <span className="muted">Perlu Review ({reports.length})</span> : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!reports && !error ? <LoadingState /> : null}
      {reports && reports.length === 0 ? (
        <EmptyState title="Tidak ada laporan menunggu review" body="Laporan yang dikirim guru untuk review akan tampil di sini. Terbitkan laporan yang sudah disetujui dari daftar Daily Reports dengan aksi yang sama di API review." />
      ) : null}
      {reports && reports.map((r) => (
        <article className="card" key={r.id}>
          <div className="row spread">
            <div>
              <h2>{r.child_name}</h2>
              <p className="muted">{r.class_name} · {new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · Guru: {r.teacher_name}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          <div className="grid three" style={{ marginTop: 10 }}>
            <div><span className="muted">Makan</span><br /><strong style={{ textTransform: "capitalize" }}>{r.meal_level || "-"}</strong></div>
            <div><span className="muted">Mood</span><br /><strong style={{ textTransform: "capitalize" }}>{r.mood || "-"}</strong></div>
            <div><span className="muted">Syarat terbit</span><br /><span>Fasilitator: {r.facilitator_name || "belum dipilih"} · Aktivitas: {r.activity_count} · Foto: {r.photo_count}</span></div>
          </div>
          {r.notes ? <p style={{ marginTop: 10 }}><span className="muted">Catatan guru:</span> {r.notes}</p> : null}
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor={`note-${r.id}`}>Catatan Review (opsional)</label>
            <input id={`note-${r.id}`} value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Tulis catatan review untuk guru..." />
          </div>
          {feedback[r.id] ? <p className="notice" role="status" style={{ marginTop: 10 }}>{feedback[r.id]}</p> : null}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn danger" disabled={busy !== null} onClick={() => act(r, "revisi")}>Kembalikan untuk Revisi</button>
            <button className="btn secondary" disabled={busy !== null} onClick={() => act(r, "setujui")}>Setujui</button>
            <button className="btn" disabled={busy !== null} onClick={() => act(r, "terbitkan")}>Setujui &amp; Kirim ke Orang Tua</button>
          </div>
        </article>
      ))}
    </>
  );
}
