"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Gagal memproses.");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
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
          <strong style={{ fontSize: 20, color: "var(--deep-blue)" }}>Lupa Kata Sandi</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Masukkan email akun kamu</span>
        </div>

        {error ? (
          <div role="alert" style={{ background: "var(--peach)", color: "var(--danger)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {message ? (
          <div style={{ background: "var(--sage)", color: "var(--ink)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            {message}
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" }}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", color: "var(--ink)" }}
          />
        </label>

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "Memproses…" : "Kirim tautan reset"}
        </button>

        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: 0 }}>
          <Link href="/login">Kembali ke halaman masuk</Link>
        </p>
      </form>
    </main>
  );
}
