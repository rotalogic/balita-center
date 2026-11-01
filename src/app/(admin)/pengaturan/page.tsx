"use client";

import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { users: AnyRow[]; rolesAgg: AnyRow[]; audit: AnyRow[] };

export default function PengaturanPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<{ counts: Record<string, number> }>("/api/counts?tables=users,roles,permissions,audit_logs");
  const error = mods.error || counts.error;

  return (
    <>
      <PageHead title="Pengaturan" subtitle="Pengguna, peran & izin RBAC, cabang, dan jejak audit" action={<Link className="btn secondary" href="/login">Buka Layar Login</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Pengguna", value: counts.data ? counts.data.counts.users : "...", icon: "☺", tone: "tone-sky" },
        { label: "Peran RBAC", value: counts.data ? counts.data.counts.roles : "...", icon: "⚑", tone: "tone-sage" },
        { label: "Izin", value: counts.data ? counts.data.counts.permissions : "...", icon: "✓", tone: "tone-peach" },
        { label: "Jejak Audit", value: counts.data ? counts.data.counts.audit_logs : "...", icon: "▤", tone: "tone-lavender" },
      ]} />
      <DataSection
        title="Peran & Pemetaan Izin"
        rows={mods.data ? mods.data.rolesAgg : null}
        emptyTitle="Seed RBAC belum terpasang"
        emptyBody="Peran dan izin berasal dari seed file SQL (10 peran, 23 izin, 105 pemetaan). Bila kosong, file SQL belum dijalankan di database ini."
        columns={[
          { key: "name", label: "Peran", render: (r) => <strong>{String(r.name)}</strong> },
          { key: "code", label: "Kode" },
          { key: "permission_count", label: "Jumlah Izin" },
          { key: "user_count", label: "Pengguna Terpetakan" },
        ]}
      />
      <DataSection
        title="Pengguna"
        rows={mods.data ? mods.data.users : null}
        emptyTitle="Belum ada pengguna"
        emptyBody="Akun pengguna dibuat saat autentikasi sungguhan diaktifkan. Paket ini belum membuat akun awal atau kata sandi bawaan."
        columns={[
          { key: "full_name", label: "Nama", render: (r) => <strong>{String(r.full_name)}</strong> },
          { key: "email", label: "Email" },
          { key: "role", label: "Peran Akun" },
          { key: "is_active", label: "Aktif", render: (r) => <StatusBadge status={r.is_active ? "aktif" : "revisi"} /> },
        ]}
      />
      <DataSection
        title="Jejak Audit Terakhir"
        rows={mods.data ? mods.data.audit : null}
        emptyTitle="Belum ada jejak audit"
        emptyBody="Aksi penting yang dicatat aplikasi ke audit_logs tampil di sini."
        columns={[
          { key: "action", label: "Aksi" },
          { key: "entity_table", label: "Tabel" },
          { key: "detail", label: "Detail" },
          { key: "created_at", label: "Waktu", render: (r) => dateFmt(r.created_at) },
        ]}
      />
      <p className="notice">Login kata sandi sungguhan belum diaktifkan di paket ini; peran tampil sebagai konteks kerja berlabel di layar login, sama seperti batas yang dinyatakan pada aplikasi hosted-nya. Untuk produksi tambahkan Auth.js/NextAuth dan kaitkan user_roles + user_branches.</p>
    </>
  );
}
