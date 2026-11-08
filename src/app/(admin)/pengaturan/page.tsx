"use client";

import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { users: AnyRow[]; rolesAgg: AnyRow[]; audit: AnyRow[] };

export default function PengaturanPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<{ counts: Record<string, number> }>("/api/counts?tables=users,roles,permissions,audit_logs");
  const storage = useApi<{ driver: string; label: string; peringatan: string | null; bucket: string | null }>("/api/storage");
  const error = mods.error || counts.error || storage.error;

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
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Jejak Audit</h2>
        <p style={{ margin: "0 0 10px" }}>
          Tercatat <strong>{counts.data ? counts.data.counts.audit_logs : "…"}</strong> entri. Untuk menyelidiki siapa
          melakukan apa, gunakan halaman Jejak Audit (jam WIB, filter aktor/aksi/entitas/tanggal, ekspor CSV).
        </p>
        <a className="btn" href="/audit">Buka Jejak Audit</a>
      </article>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Penyimpanan Foto</h2>
        <p style={{ margin: "0 0 6px" }}>
          Driver aktif: <strong>{storage.data ? storage.data.driver : "..."}</strong>
          {storage.data ? <span className="muted"> — {storage.data.label}</span> : null}
        </p>
        <p className={storage.data?.driver === "lokal" ? "notice" : "muted"} style={{ margin: 0 }}>
          {storage.data?.peringatan ||
            "Foto disimpan di object storage (S3/R2). Verifikasi dengan mengunggah satu foto di Daily Report lalu membukanya kembali."}
        </p>
      </article>
      <p className="success">Login kata sandi aktif (scrypt), sesi cookie httpOnly, RBAC ditegakkan di server pada setiap API, dan pendaftaran baru menunggu persetujuan Super Admin. Kata sandi bisa direset lewat tautan sekali pakai dari menu Pengguna, serta 2FA TOTP tersedia di halaman Akun.</p>
    </>
  );
}
