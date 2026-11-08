"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Me = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
};

const card: React.CSSProperties = {
  background: "var(--white)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: 20,
  display: "grid",
  gap: 12,
};
const field: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  color: "var(--ink)",
  width: "100%",
};
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" };

export default function AkunPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((data) => (data.ok ? setMe(data.user) : setError(data.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  async function call(path: string, payload?: unknown) {
    setError(null);
    setNotice(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error || "Gagal.");
      return null;
    }
    return data;
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)", padding: 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <div style={{ width: "min(680px, 100%)", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 20, color: "var(--deep-blue)" }}>Akun & Keamanan</strong>
          <Link href="/">← Kembali</Link>
        </div>

        {error ? <div style={{ background: "var(--peach)", color: "var(--danger)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>{error}</div> : null}
        {notice ? <div style={{ background: "var(--sage)", color: "var(--ink)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>{notice}</div> : null}

        <section style={card}>
          <strong>Profil</strong>
          {me ? (
            <div style={{ fontSize: 14, display: "grid", gap: 4 }}>
              <span>{me.full_name}</span>
              <span style={{ color: "var(--muted)" }}>{me.email}</span>
              <span style={{ color: "var(--muted)" }}>Peran: {me.roles.join(", ") || me.role}</span>
              <details>
                <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
                  {me.permissions.length} izin aktif
                </summary>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>{me.permissions.join(" · ")}</p>
              </details>
            </div>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Memuat…</span>
          )}
        </section>

        <section style={card}>
          <strong>Autentikasi Dua Faktor (2FA)</strong>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Pakai aplikasi authenticator (Google Authenticator, Aegis, 1Password).
          </p>

          {!secret ? (
            <button
              className="btn"
              type="button"
              onClick={async () => {
                const data = await call("/api/auth/2fa/setup");
                if (data) {
                  setSecret(data.secret);
                  setOtpauth(data.otpauth);
                  setNotice(data.hint);
                }
              }}
            >
              Aktifkan 2FA
            </button>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={label}>
                Secret (masukkan manual ke aplikasi authenticator)
                <input style={field} readOnly value={secret} onFocus={(e) => e.currentTarget.select()} />
              </label>
              <label style={label}>
                Atau buka tautan otpauth
                <input style={field} readOnly value={otpauth || ""} onFocus={(e) => e.currentTarget.select()} />
              </label>
              <label style={label}>
                Kode 6 digit dari aplikasi
                <input style={field} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  const data = await call("/api/auth/2fa/enable", { code });
                  if (data) {
                    setNotice(data.message);
                    setSecret(null);
                    setOtpauth(null);
                    setCode("");
                  }
                }}
              >
                Verifikasi & aktifkan
              </button>
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />

          <label style={label}>
            Matikan 2FA (masukkan kode aktif)
            <input style={field} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button
            className="btn sec"
            type="button"
            onClick={async () => {
              const data = await call("/api/auth/2fa/disable", { code });
              if (data) {
                setNotice(data.message);
                setCode("");
              }
            }}
          >
            Matikan 2FA
          </button>
        </section>
      </div>
    </main>
  );
}
