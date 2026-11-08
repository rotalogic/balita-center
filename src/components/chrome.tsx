"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Me = {
  full_name: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
};

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setMe(data.user);
      })
      .catch(() => {
        /* menu tampil setelah /api/me berhasil */
      });
  }, []);
  return me;
}

// [href, label, ikon, izin yang dibutuhkan]
const ADMIN_MENU: Array<[string, string, string, string]> = [
  ["/", "Dashboard", "⌂", "dashboard.view"],
  ["/akademik", "Akademik", "▤", "students.view"],
  ["/anak", "Anak Didik", "☺", "students.view"],
  ["/daily-reports", "Daily Reports", "✓", "dashboard.view"],
  ["/rapor", "Rapor", "▥", "students.view"],
  ["/absensi", "Absensi", "☑", "daily_reports.create"],
  ["/admission", "Admission", "✎", "admission.manage"],
  ["/keuangan", "Keuangan", "▦", "finance.view"],
  ["/sdm", "SDM", "⚑", "hr.view"],
  ["/cabang", "Cabang", "▣", "branches.manage"],
  ["/laporan", "Laporan", "▥", "reports.view"],
  ["/komunikasi", "Komunikasi", "✉", "messages.send"],
  ["/ailsa", "Ailsa", "✆", "messages.send"],
  ["/audit", "Jejak Audit", "▤", "settings.manage"],
  ["/pengaturan", "Pengaturan", "⚙", "settings.manage"],
  ["/pengguna", "Pengguna", "☗", "users.manage"],
];

const PARENT_MENU: Array<[string, string, string, string]> = [
  ["/connect", "Dashboard", "⌂", "child.view_own"],
  ["/connect/pesan", "Pesan", "✉", "child.view_own"],
  ["/connect/laporan", "Daily Report", "✓", "child.view_own"],
  ["/connect/rapor", "Rapor", "▥", "child.view_own"],
  ["/connect/perkembangan", "Perkembangan", "↗", "child.view_own"],
  ["/connect/kesehatan", "Kesehatan", "♥", "child.view_own"],
  ["/connect/kegiatan", "Kegiatan", "▦", "child.view_own"],
  ["/connect/galeri", "Galeri", "❀", "child.view_own"],
  ["/connect/pembayaran", "Pembayaran", "▦", "child.view_own"],
  ["/connect/pengaturan", "Pengaturan", "⚙", "child.view_own"],
];

function Sidebar({
  menu,
  footerNote,
  permissions,
}: {
  menu: Array<[string, string, string, string]>;
  footerNote: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const visible = menu.filter(([, , , permission]) => permissions.includes(permission));
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✿</span>
        <span className="brand-name">Balita<br />Center</span>
      </div>
      <nav className="menu" aria-label="Navigasi utama">
        {visible.map(([href, label, icon]) => {
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

function Topbar({ roleLabel, name }: { roleLabel: string; name?: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Array<{ jenis: string; label: string; ket: string; href: string }>>([]);
  const [buka, setBuka] = useState(false);
  const [cabang, setCabang] = useState("");
  const [daftarCabang, setDaftarCabang] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setDaftarCabang(d.branches || []);
        const dariUrl = new URLSearchParams(window.location.search).get("branch_id") || "";
        setCabang(dariUrl || localStorage.getItem("bc-branch") || "");
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHasil([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => (d.ok ? setHasil(d.hasil || []) : setHasil([])))
        .catch(() => setHasil([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  function pilihCabang(id: string) {
    setCabang(id);
    if (id) localStorage.setItem("bc-branch", id);
    else localStorage.removeItem("bc-branch");
    // Filter cabang berlaku di halaman yang punya parameter itu (Dashboard, Laporan).
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("branch_id", id);
    else params.delete("branch_id");
    const tujuan = ["/", "/laporan", "/daily-reports"].includes(pathname) ? pathname : "/";
    router.push(`${tujuan}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <header className="topbar">
      <label className="searchbox" style={{ position: "relative" }}>
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder="Cari anak, orang tua, guru, atau menu..."
          aria-label="Pencarian"
          value={q}
          onChange={(e) => { setQ(e.target.value); setBuka(true); }}
          onFocus={() => setBuka(true)}
          onBlur={() => setTimeout(() => setBuka(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasil[0]) router.push(hasil[0].href);
            if (e.key === "Escape") setBuka(false);
          }}
        />
        {buka && q.trim().length >= 2 ? (
          <div
            role="listbox"
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 40,
              background: "#fff", border: "1px solid #e3e7ee", borderRadius: 8,
              boxShadow: "0 8px 24px rgba(16,24,40,.10)", maxHeight: 320, overflowY: "auto",
            }}
          >
            {hasil.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 13 }} className="muted">
                Tidak ada hasil untuk “{q.trim()}”.
              </div>
            ) : (
              hasil.map((h) => (
                <button
                  key={`${h.jenis}-${h.label}-${h.href}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setBuka(false); setQ(""); router.push(h.href); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                    background: "transparent", border: 0, borderBottom: "1px solid #f1f3f7", cursor: "pointer",
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{h.label}</strong>
                  <span className="muted" style={{ fontSize: 11 }}> · {h.jenis}{h.ket ? ` · ${h.ket}` : ""}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </label>
      <div className="topbar-right">
        {daftarCabang.length > 0 ? (
          <select
            className="branch-select"
            aria-label="Pilih cabang"
            value={cabang}
            onChange={(e) => pilihCabang(e.target.value)}
          >
            <option value="">Semua Cabang</option>
            {daftarCabang.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        ) : (
          <span className="branch-select muted">Semua Cabang</span>
        )}
        <span className="bell" aria-label="Notifikasi">🔔</span>
        <span className="profile">
          <span className="avatar" aria-hidden="true">{initial}</span>
          <span>
            <strong>{name || "…"}</strong>
            <small>{roleLabel}</small>
          </span>
        </span>
        <Link className="btn small secondary" href="/akun">Akun</Link>
        <button
          type="button"
          className="btn small secondary"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const me = useMe();
  return (
    <div className="shell">
      <Sidebar
        menu={ADMIN_MENU}
        footerNote={me ? `Masuk sebagai ${me.roles.join(", ") || me.role}` : "Memuat peran…"}
        permissions={me?.permissions ?? []}
      />
      <div className="main">
        <Topbar roleLabel={me ? me.roles.join(", ") || me.role : "…"} name={me?.full_name} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function ParentShell({ children, pratinjauMungkin = false }: { children: ReactNode; pratinjauMungkin?: boolean }) {
  const me = useMe();
  const [pratinjau, setPratinjau] = useState<{ aktif: boolean; anak: string }>({ aktif: false, anak: "" });

  useEffect(() => {
    if (!pratinjauMungkin) return;
    const cek = () => {
      const p = new URLSearchParams(window.location.search);
      const tersimpan = sessionStorage.getItem("bc-konteks-preview");
      const simpan = tersimpan ? (JSON.parse(tersimpan) as { preview?: boolean; childId?: string }) : {};
      setPratinjau({
        aktif: p.get("preview") === "1" || Boolean(simpan.preview),
        anak:
          sessionStorage.getItem("bc-preview-nama") ||
          (p.get("child_id") || simpan.childId ? "anak terpilih" : ""),
      });
    };
    cek();
    const timer = setInterval(cek, 800);
    return () => clearInterval(timer);
  }, [pratinjauMungkin]);

  return (
    <div className="shell">
      <Sidebar
        menu={PARENT_MENU}
        footerNote={pratinjau.aktif ? "Mode pratinjau — hanya baca" : "Balita Connect: portal orang tua"}
        permissions={me?.permissions ?? []}
      />
      <div className="main">
        <Topbar roleLabel={pratinjau.aktif ? "Pratinjau Orang Tua" : "Orang Tua"} name={me?.full_name} />
        {pratinjau.aktif ? (
          <div className="alert" role="status" style={{ margin: "12px 24px 0" }}>
            <strong>Mode Pratinjau</strong> — Anda melihat sebagai wali {pratinjau.anak || "anak terpilih"}. Semua aksi orang tua
            (RSVP, kirim pesan, bayar) dinonaktifkan.{" "}
            <a href="/connect?preview=0">Keluar dari pratinjau</a>
          </div>
        ) : null}
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
