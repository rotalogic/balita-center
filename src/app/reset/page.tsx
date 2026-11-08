"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError("Kata sandi dan konfirmasi tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!data.ok) setError(data.error || "Gagal mengganti kata sandi.");
      else setMessage(data.message);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    color: "var(--ink)",
  };

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
          <strong style={{ fontSize: 20, color: "var(--deep-blue)" }}>Ganti Kata Sandi</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {token ? "Tautan reset terdeteksi." : "Token reset tidak ditemukan di tautan."}
          </span>
        </div>

        {error ? (
          <div role="alert" style={{ background: "var(--peach)", color: "var(--danger)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {message ? (
          <div style={{ background: "var(--sage)", color: "var(--ink)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            {message} <Link href="/login">Masuk sekarang</Link>
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" }}>
          Token
          <input type="text" required value={token} onChange={(event) => setToken(event.target.value)} style={field} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" }}>
          Kata sandi baru (min. 8)
          <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} style={field} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--muted)" }}>
          Ulangi kata sandi
          <input type="password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} style={field} />
        </label>

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "Menyimpan…" : "Simpan kata sandi"}
        </button>
      </form>
    </main>
  );
}
