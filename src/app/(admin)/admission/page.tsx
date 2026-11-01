"use client";

import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { leads: AnyRow[]; registrations: AnyRow[] };
type Counts = { counts: Record<string, number> };

export default function AdmissionPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=leads,registrations,bot_conversations,lead_followups");
  const error = mods.error || counts.error;

  return (
    <>
      <PageHead title="Admission" subtitle="Penerimaan murid, Bot WhatsApp Ailsa, screening, dan konversi pendaftaran" action={<Link className="btn" href="/anak/tambah">Daftarkan Anak Baru</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Lead Ailsa", value: counts.data ? counts.data.counts.leads : "...", icon: "✉", tone: "tone-sage" },
        { label: "Percakapan Bot", value: counts.data ? counts.data.counts.bot_conversations : "...", icon: "✿", tone: "tone-sky" },
        { label: "Pendaftaran", value: counts.data ? counts.data.counts.registrations : "...", icon: "✎", tone: "tone-peach" },
        { label: "Follow-up Terjadwal", value: counts.data ? counts.data.counts.lead_followups : "...", icon: "↻", tone: "tone-pink" },
      ]} />
      <DataSection
        title="Lead Terbaru dari Bot Ailsa"
        rows={mods.data ? mods.data.leads : null}
        emptyTitle="Belum ada lead masuk"
        emptyBody="Lead dari percakapan WhatsApp Bot Ailsa akan masuk ke tabel leads. Integrasi WhatsApp sungguhan belum tersambung di paket ini; struktur data dan status bot-nya sudah siap."
        columns={[
          { key: "parent_name", label: "Orang Tua", render: (r) => <strong>{String(r.parent_name || "-")}</strong> },
          { key: "child_name", label: "Anak" },
          { key: "wa_number", label: "WhatsApp" },
          { key: "source", label: "Sumber" },
          { key: "bot_status", label: "Status Bot", render: (r) => <StatusBadge status={String(r.bot_status || "baru")} /> },
          { key: "created_at", label: "Masuk", render: (r) => dateFmt(r.created_at) },
        ]}
      />
      <DataSection
        title="Pendaftaran & Screening"
        rows={mods.data ? mods.data.registrations : null}
        emptyTitle="Belum ada pendaftaran"
        emptyBody="Pendaftaran dari lead maupun walk-in tercatat di tabel registrations beserta status screening-nya sebelum menjadi anak didik."
        columns={[
          { key: "child_name", label: "Anak", render: (r) => <strong>{String(r.child_name || "-")}</strong> },
          { key: "parent_name", label: "Orang Tua" },
          { key: "parent_phone", label: "Telepon" },
          { key: "screening_status", label: "Screening", render: (r) => <StatusBadge status={String(r.screening_status || "menunggu")} /> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status || "baru")} /> },
          { key: "registered_at", label: "Tanggal", render: (r) => dateFmt(r.registered_at) },
        ]}
      />
    </>
  );
}
