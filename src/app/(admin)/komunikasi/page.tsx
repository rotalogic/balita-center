"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { messages: AnyRow[]; announcements: AnyRow[] };
type Counts = { counts: Record<string, number> };

export default function KomunikasiPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=parent_messages,announcements,parent_reviews,notifications");
  const error = mods.error || counts.error;
  const unread = mods.data ? mods.data.messages.filter((m) => !m.is_read).length : 0;

  return (
    <>
      <PageHead title="Komunikasi" subtitle="Pesan orang tua, pengumuman, ulasan, dan notifikasi" action={<Link className="btn secondary" href="/connect/pesan">Lihat Sisi Orang Tua</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Pesan Orang Tua", value: counts.data ? counts.data.counts.parent_messages : "...", icon: "✉", tone: "tone-sky" },
        { label: "Belum Dibaca", value: mods.data ? unread : "...", icon: "✉", tone: "tone-peach" },
        { label: "Pengumuman", value: counts.data ? counts.data.counts.announcements : "...", icon: "📣", tone: "tone-sage" },
        { label: "Ulasan Orang Tua", value: counts.data ? counts.data.counts.parent_reviews : "...", icon: "★", tone: "tone-pink" },
      ]} />
      <DataSection
        title="Pengumuman Sekolah"
        rows={mods.data ? mods.data.announcements : null}
        emptyTitle="Belum ada pengumuman"
        emptyBody="Pengumuman sekolah dari tabel announcements tampil di sini, yang tersemat tampil paling atas."
        columns={[
          { key: "title", label: "Judul", render: (r) => <strong>{String(r.title)}</strong> },
          { key: "audience", label: "Tujuan" },
          { key: "is_pinned", label: "Tersemat", render: (r) => (r.is_pinned ? "Ya" : "Tidak") },
          { key: "created_at", label: "Dibuat", render: (r) => dateFmt(r.created_at) },
        ]}
      />
      <DataSection
        title="Pesan Orang Tua Terbaru"
        rows={mods.data ? mods.data.messages : null}
        emptyTitle="Belum ada pesan"
        emptyBody="Pesan dari sekolah untuk orang tua tercatat di parent_messages dan terbaca di Balita Connect sisi orang tua."
        columns={[
          { key: "child_name", label: "Anak", render: (r) => <strong>{String(r.child_name)}</strong> },
          { key: "sender_name", label: "Pengirim" },
          { key: "subject", label: "Subjek" },
          { key: "sent_at", label: "Terkirim", render: (r) => dateFmt(r.sent_at) },
          { key: "is_read", label: "Dibaca", render: (r) => (r.is_read ? "Ya" : "Belum") },
        ]}
      />
    </>
  );
}
