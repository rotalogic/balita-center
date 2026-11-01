"use client";

import { useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectKegiatanPage() {
  const { data, error, reload } = useConnect();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return (<><PageHead title="Kalender Kegiatan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Kalender Kegiatan" /><LoadingState /></>);

  async function rsvp(eventId: string, response: "hadir" | "tidak_hadir") {
    if (!data?.child) return;
    setBusy(eventId + response);
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "rsvp", child_id: data.child.id, event_id: eventId, response }),
    });
    const result = await res.json();
    setBusy(null);
    setFeedback({ [eventId]: result.ok ? `Konfirmasi tersimpan: ${response === "hadir" ? "Akan Hadir" : "Tidak Hadir"}.` : result.error || "Gagal menyimpan konfirmasi." });
    if (result.ok) reload();
  }

  return (
    <>
      <PageHead title="Kalender Kegiatan" subtitle="Lihat jadwal kegiatan sekolah, acara khusus, dan agenda penting" />
      {data.events.length === 0 ? (
        <EmptyState title="Belum ada kegiatan terjadwal" body="Kegiatan sekolah tampil setelah admin atau guru menambahkannya di tabel school_events." />
      ) : (
        <div className="grid two">
          {data.events.map((e) => (
            <article className="card" key={String(e.id)}>
              <div className="row spread">
                <h2 style={{ fontSize: 17 }}>{e.title}</h2>
                <span className="badge neutral">{e.category}</span>
              </div>
              <p className="muted">
                {new Date(String(e.event_date)).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {e.start_time ? ` · ${String(e.start_time).slice(0, 5)} - ${String(e.end_time || "").slice(0, 5)} WIB` : ""}
                <br />{e.location || ""}
              </p>
              <p>{e.description || ""}</p>
              <div className="row spread">
                <span>{e.my_rsvp ? <>Konfirmasi Anda: <StatusBadge status={String(e.my_rsvp)} /></> : <span className="muted">Belum konfirmasi kehadiran</span>}</span>
                <span className="row">
                  <button className="btn small" disabled={busy !== null} onClick={() => rsvp(String(e.id), "hadir")}>Akan Hadir</button>
                  <button className="btn small danger" disabled={busy !== null} onClick={() => rsvp(String(e.id), "tidak_hadir")}>Tidak Hadir</button>
                </span>
              </div>
              {feedback[String(e.id)] ? <p className="notice" role="status" style={{ marginTop: 10 }}>{feedback[String(e.id)]}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
