"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ADMIN_MENU: Array<[string, string, string]> = [
  ["/", "Dashboard", "⌂"],
  ["/akademik", "Akademik", "▤"],
  ["/anak", "Anak Didik", "☺"],
  ["/daily-reports", "Daily Reports", "✓"],
  ["/admission", "Admission", "✎"],
  ["/keuangan", "Keuangan", "▦"],
  ["/sdm", "SDM", "⚑"],
  ["/cabang", "Cabang", "▣"],
  ["/laporan", "Laporan", "▥"],
  ["/komunikasi", "Komunikasi", "✉"],
  ["/pengaturan", "Pengaturan", "⚙"],
];

const PARENT_MENU: Array<[string, string, string]> = [
  ["/connect", "Dashboard", "⌂"],
  ["/connect/pesan", "Pesan", "✉"],
  ["/connect/laporan", "Daily Report", "✓"],
  ["/connect/perkembangan", "Perkembangan", "↗"],
  ["/connect/kesehatan", "Kesehatan", "♥"],
  ["/connect/kegiatan", "Kegiatan", "▦"],
];

function Sidebar({ menu, footerNote }: { menu: Array<[string, string, string]>; footerNote: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✿</span>
        <span className="brand-name">Balita<br />Center</span>
      </div>
      <nav className="menu" aria-label="Navigasi utama">
        {menu.map(([href, label, icon]) => {
          const active = href === "/" || href === "/connect" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "menu-item active" : "menu-item"}>
              <span className="menu-icon" aria-hidden="true">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-art">
        <div className="sidebar-art-emoji" aria-hidden="true">🌼</div>
        <p className="sidebar-tagline">Tumbuh Bahagia<br />Bersama<br />Setiap Langkah</p>
        <span className="sidebar-heart" aria-hidden="true">♥</span>
      </div>
      <p className="sidebar-note">{footerNote}</p>
    </aside>
  );
}

function Topbar({ roleLabel }: { roleLabel: string }) {
  return (
    <header className="topbar">
      <label className="searchbox">
        <span aria-hidden="true">🔍</span>
        <input type="search" placeholder="Cari anak, orang tua, guru, atau menu..." aria-label="Pencarian" />
      </label>
      <div className="topbar-right">
        <span className="branch-select" aria-hidden="true">Semua Cabang ▾</span>
        <span className="bell" aria-label="Notifikasi">🔔</span>
        <span className="profile">
          <span className="avatar" aria-hidden="true">W</span>
          <span>
            <strong>Wildan</strong>
            <small>{roleLabel}</small>
          </span>
        </span>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar menu={ADMIN_MENU} footerNote="Konteks peran: Super Admin (demo akses, bukan login kata sandi)" />
      <div className="main">
        <Topbar roleLabel="Super Admin" />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function ParentShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar menu={PARENT_MENU} footerNote="Balita Connect: portal orang tua" />
      <div className="main">
        <Topbar roleLabel="Orang Tua" />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon" aria-hidden="true">🌱</div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function LoadingState({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="empty" role="status" aria-live="polite">
      <div className="empty-icon" aria-hidden="true">⏳</div>
      <strong>{label}</strong>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="empty error" role="alert">
      <div className="empty-icon" aria-hidden="true">⚠</div>
      <strong>Data belum bisa dimuat</strong>
      <p>{message}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "aktif" || status === "published" || status === "disetujui" || status === "lunas" || status === "hadir"
      ? "badge ok"
      : status === "menunggu_review" || status === "menunggu" || status === "belum_bayar"
        ? "badge warn"
        : status === "revisi" || status === "ditolak" || status === "batal"
          ? "badge danger"
          : "badge neutral";
  const label = status.replace(/_/g, " ");
  return <span className={cls}>{label}</span>;
}
