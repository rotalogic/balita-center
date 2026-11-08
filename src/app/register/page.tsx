"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  color: "var(--ink)",
};
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" };

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "orang_tua", organization_name: "" });
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [roles, setRoles] = useState<Array<{ code: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/roles")
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setRoles(data.roles);
      })
      .catch(() => setError("Tidak dapat memuat daftar peran."));
  }, []);

  function update(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Gagal mendaftar.");
        setBusy(false);
        return;
      }
      if (data.pending) {
        setPendingMsg(data.message || "Pendaftaran berhasil. Akun menunggu persetujuan Super Admin.");
        setForm({ full_name: "", email: "", phone: "", password: "", role: "orang_tua", organization_name: "" });
        return;
      }
      window.location.href = data.redirect || "/connect";
    } catch {
      setError("Tidak dapat menghubungi server.");
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cream)", padding: 24 }}>
      <form
        onSubmit={submit}
        style={{
          width: 380,
          background: "var(--white)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: 28,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: 20, color: "var(--deep-blue)" }}>Daftar Akun</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Pilih peran sesuai posisi kamu. Peran Super Admin hanya bisa diberikan admin.
          </span>
        </div>

        {pendingMsg ? (
          <p style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#EAF7EE", color: "#1B6B33", fontSize: 13 }}>
            {pendingMsg} <a href="/login">Ke halaman masuk</a>
          </p>
        ) : null}
        {error ? (
          <div role="alert" style={{ background: "var(--peach)", color: "var(--danger)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <label style={labelStyle}>
          Nama lengkap
          <input type="text" required minLength={3} value={form.full_name} onChange={update("full_name")} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Email
          <input type="email" required autoComplete="email" value={form.email} onChange={update("email")} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Nomor HP (opsional)
          <input type="tel" value={form.phone} onChange={update("phone")} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Nama Sekolah / Organisasi
          <input type="text" required minLength={3} value={form.organization_name} onChange={update("organization_name")} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Daftar sebagai
          <select
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            style={inputStyle}
          >
            {roles.length === 0 ? <option value="orang_tua">Orang Tua</option> : null}
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Kata sandi (min. 8 karakter)
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={update("password")} style={inputStyle} />
        </label>

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "Mendaftarkan…" : "Daftar"}
        </button>

        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: 0 }}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </form>
    </main>
  );
}
