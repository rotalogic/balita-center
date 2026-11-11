"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { LaporanWeb } from "@/components/laporan-web";

type Report = {
  id: string;
  report_date: string;
  status: string;
  mood: string | null;
  meal_level: string | null;
  snack_level: string | null;
  meals_text: string | null;
  snack_text: string | null;
  nap_quality: string | null;
  nap_start: string | null;
  nap_end: string | null;
  toilet_pee_count: number | null;
  toilet_poop_count: number | null;
  mood_notes: string | null;
  notes: string | null;
  circle_theme: string | null;
  circle_rating: number | null;
  circle_notes: string | null;
  special_moment: string | null;
  home_suggestion: string | null;
  child_name: string;
  class_name: string;
  teacher_photo: string | null;
  teacher_ttd: string | null;
  teacher_name: string;
  facilitator_name: string | null;
};

type Activity = {
  id: string;
  activity_time: string | null;
  title: string;
  apparatus: string | null;
  area: string | null;
  rating: number | null;
  notes: string | null;
  photo_url: string | null;
  location: string | null;
  companion: string | null;
  work_location: string | null;
  work_mode: string | null;
};

type Photo = { id: string; photo_url: string; media_type?: string; poster_url?: string | null; caption?: string | null };

const tanggal = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(
    new Date(iso)
  );

const EDITABLE = ["draft", "revisi"];

export default function DailyReportDetailPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<Report | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [segments, setSegments] = useState<Array<{ segmen: string; catatan: string }>>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kurang, setKurang] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/daily-reports/${params.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Laporan tidak bisa dimuat.");
          return;
        }
        setReport(data.report);
        setActivities(data.activities || []);
        setSegments(data.segments || []);
        setPhotos(data.photos || []);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function kirimReview() {
    setBusy(true);
    setKurang([]);
    setInfo(null);
    const response = await fetch(`/api/daily-reports/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submit: true }),
    });
    const data = await response.json();
    setBusy(false);
    if (data.ok) {
      setInfo("Laporan terkirim untuk review.");
      load();
      return;
    }
    if (Array.isArray(data.kurang) && data.kurang.length > 0) setKurang(data.kurang);
    setError(data.error || "Gagal mengirim laporan.");
  }

  async function hapusDraft() {
    if (!window.confirm("Hapus draft laporan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    setBusy(true);
    const response = await fetch(`/api/daily-reports/${params.id}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);
    if (data.ok) {
      window.location.href = "/daily-reports";
      return;
    }
    setError(data.error || "Gagal menghapus draft.");
  }

  if (error && !report) {
    return (
      <>
        <PageHead title="Detail Daily Report" />
        <ErrorState message={error} />
        <p style={{ marginTop: 12 }}><Link className="btn secondary" href="/daily-reports">&larr; Kembali ke daftar</Link></p>
      </>
    );
  }
  if (!report) return (<><PageHead title="Detail Daily Report" /><LoadingState /></>);

  const bisaEdit = EDITABLE.includes(report.status);

  return (
    <>
      <PageHead
        title={`${report.child_name} · ${tanggal(report.report_date)}`}
        subtitle={`${report.class_name} · Guru ${report.teacher_name}`}
        action={
          <span className="row">
            <Link className="btn secondary" href="/daily-reports">&larr; Kembali</Link>
            {bisaEdit ? <Link className="btn" href={`/daily-reports/buat?id=${report.id}`}>Edit Laporan</Link> : null}
            {bisaEdit ? (
              <button type="button" className="btn" disabled={busy} onClick={kirimReview}>
                {busy ? "Memproses…" : "Kirim untuk Review"}
              </button>
            ) : null}
            {report.status === "draft" ? (
              <button type="button" className="btn secondary" disabled={busy} onClick={hapusDraft}>Hapus Draft</button>
            ) : null}
          </span>
        }
      />

      <p><StatusBadge status={report.status} /></p>
      {info ? <p className="success" role="status">{info}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {kurang.length > 0 ? (
        <div className="card" role="alert">
          <h2 style={{ marginTop: 0 }}>Syarat terbit belum lengkap</h2>
          <ul style={{ margin: "8px 0 0 18px" }}>
            {kurang.map((item) => (<li key={item}>{item}</li>))}
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>Lengkapi lewat tombol <strong>Edit Laporan</strong>, lalu kirim ulang.</p>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <LaporanWeb
          report={report}
          activities={activities}
          segments={segments}
          childName={report.child_name}
          childPhoto={(report as Record<string, unknown>).child_photo as string || null}
          folderUrl={(report as Record<string, unknown>).child_folder as string || null}
          reporterName={report.teacher_name}
          reporterPhoto={report.teacher_photo}
          reporterTtd={report.teacher_ttd}
          pdfUrl={report.status === "published" ? `/api/dokumen/laporan/${report.id}/pdf` : null}
        />
      </div>

      {photos.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Foto &amp; Video Galeri ({photos.length})</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {photos.map((photo) =>
              photo.media_type === "video" ? (
                <video key={photo.id} src={photo.photo_url} poster={photo.poster_url || undefined} controls preload="metadata" width={196} height={110} style={{ objectFit: "cover", borderRadius: 8, display: "block", background: "#000" }} />
              ) : (
                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noreferrer">
                  <img src={photo.photo_url} alt="Foto galeri laporan" width={110} height={110} style={{ objectFit: "cover", borderRadius: 8, display: "block" }} />
                </a>
              )
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
