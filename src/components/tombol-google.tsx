"use client";

import { useEffect, useState } from "react";

// Tombol Masuk/Daftar dengan Google. Keaktifannya dibaca dari server supaya
// tombol tidak menjanjikan sesuatu yang belum dikonfigurasi pemilik server.
export function TombolGoogle({ label, next }: { label: string; next?: string }) {
  const [aktif, setAktif] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/metode")
      .then((r) => r.json())
      .then((d) => setAktif(Boolean(d.google)))
      .catch(() => setAktif(false));
  }, []);

  if (aktif === null) return null;

  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const isi = (
    <>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-9z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z" />
        <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z" />
      </svg>
      <span>{label}</span>
    </>
  );
  const gaya: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  };

  if (!aktif) {
    return (
      <div style={{ marginTop: 12 }}>
        <button type="button" className="btn secondary" disabled style={{ ...gaya, opacity: 0.6 }}>
          {isi}
        </button>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6, textAlign: "center" }}>
          Belum diaktifkan admin sekolah.
        </p>
      </div>
    );
  }

  return (
    <a href={href} className="btn secondary" style={{ ...gaya, marginTop: 12, textDecoration: "none" }}>
      {isi}
    </a>
  );
}
