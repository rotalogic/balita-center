"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Layar login meniru tampilan versi Muse: panel visual kiri + kartu login kanan.
// PENTING: ini login konteks kerja berlabel, BUKAN autentikasi sungguhan.
// Kata sandi tidak diperiksa dan tidak dikirim ke mana pun; memilih peran hanya
// menyimpan label peran di peramban untuk ditampilkan di topbar. Produksi wajib
// mengganti halaman ini dengan Auth.js/NextAuth yang memeriksa kredensial.
const ROLES = [
  { value: "Super Admin", target: "/" },
  { value: "Kepala Sekolah", target: "/" },
  { value: "Admin Cabang", target: "/" },
  { value: "Guru / Fasilitator", target: "/daily-reports" },
  { value: "Staf Administrasi", target: "/" },
  { value: "Bendahara", target: "/keuangan" },
  { value: "Investor", target: "/investor" },
  { value: "Orang Tua", target: "/connect" },
  { value: "Kandidat / Calon Karyawan", target: "/" },
  { value: "Tamu / Calon Orang Tua", target: "/connect" },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState(ROLES[0]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function masuk(event: React.FormEvent) {
    event.preventDefault();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Format email belum benar.");
      return;
    }
    try {
      window.localStorage.setItem("bc-role", role.value);
    } catch {
      // penyimpanan lokal tidak tersedia; tetap lanjut masuk
    }
    router.push(role.target);
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
        <form className="login-card" onSubmit={masuk}>
          <div className="brand" style={{ padding: 0 }}>
            <span className="brand-mark" aria-hidden="true">✿</span>
            <span className="brand-name">Balita Center</span>
          </div>
          <h1 style={{ fontSize: 24, marginTop: 14 }}>Selamat Datang</h1>
          <p className="muted" style={{ marginTop: 4 }}>Masuk untuk melanjutkan ke ruang kerja Anda.</p>

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" placeholder="nama@balitacenter.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="password">Kata Sandi</label>
            <input id="password" type="password" autoComplete="current-password" placeholder="••••••••" />
            <span className="hint">Pada paket ini kata sandi tidak diperiksa (belum ada autentikasi sungguhan).</span>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="role">Masuk sebagai peran</label>
            <select id="role" value={role.value} onChange={(e) => setRole(ROLES.find((r) => r.value === e.target.value) || ROLES[0])}>
              {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.value}</option>))}
            </select>
          </div>
          {error ? <p className="notice" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
          <button className="btn" type="submit" style={{ width: "100%", marginTop: 18 }}>Masuk</button>
          <p className="notice" role="note" style={{ marginTop: 14 }}>
            Konteks kerja simulasi untuk mencoba aplikasi. Belum ada login kata sandi atau Google/Microsoft sungguhan di paket ini.
          </p>
        </form>
      </section>
    </div>
  );
}
