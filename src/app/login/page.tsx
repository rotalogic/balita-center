"use client";

import { MerekAplikasi } from "@/components/merek-sekolah";
import { TombolGoogle } from "@/components/tombol-google";

import { useState } from "react";
import Link from "next/link";

// Login sungguhan: kredensial diperiksa ke tabel users (scrypt) dan sesi
// disimpan sebagai cookie bertanda tangan. Tampilan mengikuti versi Muse.
const PESAN_GOOGLE: Record<string, string> = {
  menunggu:
    "Akun Google Anda diterima. Pendaftaran masih menunggu persetujuan Super Admin, Anda bisa masuk sesudah disetujui.",
  "google-belum": "Masuk dengan Google belum diaktifkan. Hubungi admin sekolah.",
  "google-gagal": "Masuk dengan Google gagal. Coba lagi, atau masuk dengan email dan kata sandi.",
  "google-email": "Email akun Google Anda belum terverifikasi, jadi belum bisa dipakai masuk.",
  "akun-nonaktif": "Akun Anda dinonaktifkan. Hubungi admin sekolah.",
};

export default function LoginPage() {
  const [stage, setStage] = useState<"credentials" | "totp">(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dua") === "1"
      ? "totp"
      : "credentials"
  );
  const [pesanGoogle] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const kode = new URLSearchParams(window.location.search).get("pesan");
    return kode ? PESAN_GOOGLE[kode] || null : null;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sesiHabis] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sesi") === "berakhir"
  );

  function goNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.needs2fa) {
        setStage("totp");
        setBusy(false);
        return;
      }
      if (!data.ok) {
        setError(data.error || "Email atau kata sandi salah.");
        setBusy(false);
        return;
      }
      goNext();
    } catch {
      setError("Tidak dapat menghubungi server.");
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Kode 2FA salah.");
        setBusy(false);
        return;
      }
      goNext();
    } catch {
      setError("Tidak dapat menghubungi server.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-hero" aria-hidden="true">
        <div className="login-hero-inner">
          <div className="login-hero-emoji">🌼 🧸 📚</div>
          <h2>Tumbuh Bahagia Bersama Setiap Langkah</h2>
          <p>Lingkungan Montessori yang hangat untuk anak, guru, dan orang tua.</p>
          <div className="login-hero-dots"><span /><span /><span /></div>
        </div>
      </section>

      <section className="login-card-wrap">
        {stage === "credentials" ? (
          <form className="login-card" onSubmit={submitCredentials}>
            <div className="brand" style={{ padding: 0 }}>
              <MerekAplikasi />
            </div>
            <h1 style={{ fontSize: 24, marginTop: 14 }}>Selamat Datang</h1>
            <p className="muted" style={{ marginTop: 4 }}>Masuk untuk melanjutkan ke ruang kerja Anda.</p>

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                placeholder="nama@sekolah.sch.id"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="password">Kata Sandi</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {pesanGoogle ? <p className="notice" role="status" style={{ marginTop: 12 }}>{pesanGoogle}</p> : null}
            {error ? <p className="notice" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}

            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
              {busy ? "Memeriksa…" : "Masuk"}
            </button>

            <p className="muted" style={{ textAlign: "center", marginTop: 14, fontSize: 12.5 }}>atau</p>
            <TombolGoogle label="Masuk dengan Google" />

            <p className="notice" role="note" style={{ marginTop: 14 }}>
              <Link href="/forgot">Lupa kata sandi?</Link>
              {" · "}
              <Link href="/register">Daftar akun</Link>
            </p>
          </form>
        ) : (
          <form className="login-card" onSubmit={submitCode}>
            <div className="brand" style={{ padding: 0 }}>
              <MerekAplikasi />
            </div>
            <h1 style={{ fontSize: 24, marginTop: 14 }}>Verifikasi 2FA</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Masukkan kode 6 digit dari aplikasi authenticator.
            </p>

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="code">Kode 2FA</label>
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>

            {error ? <p className="notice" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}

            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
              {busy ? "Memeriksa…" : "Verifikasi"}
            </button>
            <button
              type="button"
              className="btn sec"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                setStage("credentials");
                setCode("");
                setError(null);
              }}
            >
              Kembali
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
