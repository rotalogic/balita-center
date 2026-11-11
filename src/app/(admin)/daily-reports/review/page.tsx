"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { kataSkor } from "@/lib/skala";

type Report = {
  id: string; report_date: string; status: string; mood: string | null; meal_level: string | null;
  child_name: string; class_name: string; teacher_name: string; facilitator_name: string | null;
  photo_count: string; activity_count: string;
};
type Detail = {
  report: Record<string, string | null> & { child_name: string; class_name: string; teacher_name: string; facilitator_name: string | null };
  activities: Array<Record<string, string | number | null>>;
  photos: Array<Record<string, string | null>>;
};
type Staff = { id: string; full_name: string; position: string };

const TABS: Array<[string, string]> = [
  ["menunggu_review", "Perlu Review"], ["disetujui", "Disetujui"], ["revisi", "Revisi"], ["published", "Terbit"],
];

export default function ReviewPage() {
  const [tab, setTab] = useState("menunggu_review");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = (status: string) => {
    fetch(`/api/daily-reports?status=${encodeURIComponent(status)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setReports(d.reports);
          setSelectedId(d.reports.length > 0 ? d.reports[0].id : null);
        } else setError(d.error);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  };

  useEffect(() => { loadList(tab); setFeedback(null); setNote(""); }, [tab]);
  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then((d) => {
      if (d.ok) { setStaff(d.staff); if (d.staff.length > 0) setReviewer((prev) => prev || d.staff[0].id); }
    }).catch(() => null);
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/daily-reports/${selectedId}`).then((r) => r.json()).then((d) => (d.ok ? setDetail(d) : setDetail(null))).catch(() => setDetail(null));
  }, [selectedId]);

  const starredOk = detail ? detail.activities.some((a) => Number(a.rating || 0) > 0 && a.apparatus) : false;
  const allStarredOk = detail ? detail.activities.filter((a) => Number(a.rating || 0) > 0).every((a) => !!a.apparatus) : false;
  const photoOk = detail ? detail.photos.length > 0 || detail.activities.some((a) => !!a.photo_url) : false;
  const facilitatorOk = detail ? !!detail.report.lead_facilitator_id : false;
  const canPublish = facilitatorOk && starredOk && allStarredOk && photoOk;

  async function act(action: "setujui" | "revisi" | "terbitkan") {
    if (!selectedId) return;
    if (!reviewer) { setFeedback("Pilih reviewer dulu."); return; }
    setBusy(true);
    const res = await fetch(`/api/daily-reports/${selectedId}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewer_id: reviewer, notes: note || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      setFeedback(`Berhasil: laporan kini berstatus ${String(data.status).replace(/_/g, " ")}.`);
      loadList(tab);
    } else {
      setFeedback(data.error || "Aksi gagal.");
    }
  }

  return (
    <>
      <PageHead title="Review & Approval Daily Report" subtitle="Tinjau laporan harian dari guru sebelum diteruskan ke orang tua" />
      <div className="tab-row" role="group" aria-label="Tab review laporan">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? "tab-pill active" : "tab-pill"} onClick={() => setTab(value)} aria-pressed={tab === value}>
            {label}{value === "menunggu_review" && reports && tab === value ? ` (${reports.length})` : ""}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="editor-grid">
        <div className="card">
          <h2>Daftar Laporan</h2>
          {!reports ? <LoadingState /> : reports.length === 0 ? (
            <EmptyState title="Tidak ada laporan pada tab ini" body="Laporan berpindah tab mengikuti statusnya: menunggu review, disetujui, revisi, atau terbit." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Anak</th><th>Tanggal</th><th>Guru</th><th>Status</th></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} style={{ cursor: "pointer", background: selectedId === r.id ? "var(--sage)" : undefined }} aria-selected={selectedId === r.id}>
                      <td><strong>{r.child_name}</strong><div className="muted">{r.class_name}</div></td>
                      <td>{new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                      <td>{r.teacher_name}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="card">
          <h2>Pratinjau Laporan</h2>
          {!selectedId ? <p className="muted">Pilih laporan dari daftar untuk melihat pratinjau lengkapnya.</p> : !detail ? <LoadingState label="Memuat pratinjau..." /> : (
            <>
              <p style={{ margin: "4px 0" }}><strong>{detail.report.child_name}</strong> · {detail.report.class_name}<br />
              <span className="muted">{String(detail.report.report_date)} · Guru: {detail.report.teacher_name} · Mood: {String(detail.report.mood || "-")} · Makan: {String(detail.report.meal_level || "-")}</span></p>
              <h3>Aktivitas ({detail.activities.length})</h3>
              {detail.activities.length === 0 ? <p className="muted">Tidak ada aktivitas tercatat.</p> : (
                <ul className="timeline">
                  {detail.activities.map((a) => (
                    <li key={String(a.id)}><time>{String(a.activity_time || "").slice(0, 5) || "--:--"}</time><div><strong>{String(a.title)}</strong><div className="muted">{String(a.apparatus || "tanpa aparatus")} · penilaian {kataSkor(a.rating) || "belum dinilai"}</div></div></li>
                  ))}
                </ul>
              )}
              <h3 style={{ marginTop: 12 }}>Syarat Terbit</h3>
              <ul className="checklist">
                <li><span className={facilitatorOk ? "ok-mark" : "no-mark"}>{facilitatorOk ? "✓" : "✕"}</span> Fasilitator utama {detail.report.facilitator_name ? `(${detail.report.facilitator_name})` : "belum dipilih"}</li>
                <li><span className={starredOk ? "ok-mark" : "no-mark"}>{starredOk ? "✓" : "✕"}</span> Ada aktivitas yang dinilai dengan aparatus</li>
                <li><span className={allStarredOk ? "ok-mark" : "no-mark"}>{allStarredOk ? "✓" : "✕"}</span> Semua aktivitas yang dinilai punya aparatus</li>
                <li><span className={photoOk ? "ok-mark" : "no-mark"}>{photoOk ? "✓" : "✕"}</span> Minimal 1 foto dokumentasi ({detail.photos.length} foto galeri)</li>
              </ul>
              <div className="field">
                <label htmlFor="reviewer">Reviewer</label>
                <select id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
                  <option value="">Pilih staf reviewer</option>
                  {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name} · {s.position}</option>))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor="note">Catatan Review (opsional)</label>
                <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis catatan review untuk guru..." />
              </div>
              {feedback ? <p className="notice" role="status" style={{ marginTop: 10 }}>{feedback}</p> : null}
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn danger" disabled={busy} onClick={() => act("revisi")}>Kembalikan untuk Revisi</button>
                <button className="btn secondary" disabled={busy} onClick={() => act("setujui")}>Setujui</button>
                <button className="btn" disabled={busy || !canPublish} title={canPublish ? undefined : "Syarat terbit belum lengkap, lihat checklist"} onClick={() => act("terbitkan")}>Setujui &amp; Kirim ke Orang Tua</button>
              </div>
              {!canPublish ? <p className="hint muted" style={{ marginTop: 8 }}>Tombol kirim nonaktif selama syarat terbit belum lengkap. Gerbang yang sama juga dijaga trigger database di server.</p> : null}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
