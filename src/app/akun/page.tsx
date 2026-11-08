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

        <ProfilGuru />

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

type StafProfil = { id: string; full_name: string; position: string | null; photo_url: string | null; signature_url: string | null };

function ProfilGuru() {
  const [staf, setStaf] = useState<StafProfil | null | undefined>(undefined);
  const [sibuk, setSibuk] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/akun/profil")
      .then((r) => r.json())
      .then((d) => setStaf(d.ok ? d.staf : null))
      .catch(() => setStaf(null));
  }, []);

  async function unggah(jenis: "foto" | "ttd", file: File | null) {
    if (!file) return;
    setSibuk(jenis);
    setInfo(null);
    const fd = new FormData();
    fd.append("jenis", jenis);
    fd.append("file", file);
    const r = await fetch("/api/akun/profil", { method: "POST", body: fd });
    const d = await r.json();
    setSibuk("");
    if (d.ok) {
      setStaf((s) => (s ? { ...s, [jenis === "foto" ? "photo_url" : "signature_url"]: d.url } : s));
      setInfo(jenis === "foto" ? "Foto profil tersimpan." : "Tanda tangan tersimpan — akan tampil di laporan & rapor berikutnya.");
    } else setInfo(d.error || "Gagal mengunggah.");
  }

  if (staf === undefined) return (<section style={card}><strong>Profil Guru</strong><span style={{ color: "var(--muted)", fontSize: 14 }}>Memuat…</span></section>);
  if (!staf) return (
    <section style={card}>
      <strong>Profil Guru</strong>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Akun Anda belum terhubung ke data staf, jadi foto profil dan tanda tangan digital belum tersedia.
        Minta admin menghubungkan akun ini ke profil guru Anda.
      </p>
    </section>
  );

  return (
    <section style={card}>
      <strong>Profil Guru — {staf.full_name}{staf.position ? ` · ${staf.position}` : ""}</strong>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          {staf.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staf.photo_url} alt="Foto profil" style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
          ) : (
            <span style={{ width: 92, height: 92, borderRadius: "50%", background: "var(--cream)", border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: 30, color: "var(--muted)" }}>{staf.full_name.charAt(0)}</span>
          )}
          <label className="btn small secondary" style={{ cursor: "pointer" }}>
            {sibuk === "foto" ? "Mengunggah…" : "Unggah Foto Profil"}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void unggah("foto", e.target.files?.[0] || null)} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>JPG/PNG/WEBP, maks 5 MB.</span>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          {staf.signature_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staf.signature_url} alt="Tanda tangan digital" style={{ height: 92, maxWidth: 230, objectFit: "contain", background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: 6 }} />
          ) : (
            <span style={{ height: 92, width: 230, background: "#fff", border: "1px dashed var(--line)", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, color: "var(--muted)", textAlign: "center", padding: 8 }}>Belum ada tanda tangan</span>
          )}
          <label className="btn small secondary" style={{ cursor: "pointer" }}>
            {sibuk === "ttd" ? "Mengunggah…" : "Unggah Tanda Tangan"}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void unggah("ttd", e.target.files?.[0] || null)} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)", maxWidth: 300 }}>
            Foto tanda tangan di kertas putih atau PNG latar transparan, maks 2 MB.
            Tanda tangan ini tampil otomatis di kaki laporan harian dan rapor yang Anda terbitkan.
          </span>
        </div>
      </div>
      {info ? <p style={{ fontSize: 13, margin: 0 }}>{info}</p> : null}
    </section>
  );
}
