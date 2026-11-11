import type { ReactNode } from "react";
import Link from "next/link";
import { ALAMAT_LEMBAGA, MAPS_LINK, NAV_PUBLIK, NOMOR_CS, WA_LINK } from "@/lib/publik";

// Kerangka website publik lembaga — terpisah penuh dari kerangka aplikasi.
// Satu pintu resmi ke sistem: tombol Masuk Portal menuju halaman masuk.
export default function PublikLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pb-wrap">
      <style>{`
        .pb-wrap { --zkc:#8A6844; --sam:#4F7A54; --ink:#2b2118; --cream:#faf6ef; font-family: Inter, system-ui, sans-serif; color: var(--ink); background: var(--cream); min-height: 100vh; }
        .pb-head { position: sticky; top: 0; z-index: 20; background: rgba(250,246,239,.95); border-bottom: 1px solid #e7dcc9; backdrop-filter: blur(6px); }
        .pb-head-in { max-width: 1120px; margin: 0 auto; padding: 10px 16px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .pb-brand { font-family: "Plus Jakarta Sans", sans-serif; font-weight: 800; font-size: 17px; color: var(--zkc); text-decoration: none; line-height: 1.15; }
        .pb-brand small { display: block; font-weight: 600; font-size: 11px; color: var(--sam); letter-spacing: .4px; }
        .pb-nav { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
        .pb-nav a { color: var(--ink); text-decoration: none; font-size: 13.5px; padding: 6px 9px; border-radius: 999px; }
        .pb-nav a:hover { background: #f0e7d7; }
        .pb-portal { background: var(--sam); color: #fff !important; font-weight: 600; }
        .pb-main { max-width: 1120px; margin: 0 auto; padding: 26px 16px 48px; }
        .pb-hero { background: linear-gradient(135deg, #f3e9d8, #e9f0e6); border: 1px solid #e7dcc9; border-radius: 20px; padding: 34px 26px; }
        .pb-hero h1 { font-family: "Plus Jakarta Sans", sans-serif; font-size: 32px; margin: 0 0 8px; color: var(--zkc); }
        .pb-hero p.tag { font-size: 17px; color: #57462f; margin: 0; }
        .pb-sec { margin-top: 40px; }
        .pb-sec > h2 { font-family: "Plus Jakarta Sans", sans-serif; font-size: 24px; color: var(--zkc); margin: 0 0 6px; }
        .pb-sec > p.lead { color: #57462f; margin-top: 0; max-width: 760px; }
        .pb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
        .pb-card { background: #fff; border: 1px solid #e7dcc9; border-radius: 14px; padding: 18px; }
        .pb-card h3 { margin: 0 0 6px; font-size: 16.5px; }
        .pb-card p { margin: 0; color: #57462f; font-size: 14.5px; line-height: 1.55; }
        .pb-btn { display: inline-block; background: var(--zkc); color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 14.5px; border: none; cursor: pointer; }
        .pb-btn.hijau { background: var(--sam); }
        .pb-btn.wa { background: #25D366; color: #123; }
        .pb-btn.garis { background: transparent; color: var(--zkc); border: 1.5px solid var(--zkc); }
        .pb-strip { background: var(--zkc); color: #fdf8f0; border-radius: 14px; padding: 18px 22px; }
        .pb-strip h3 { margin: 0 0 6px; }
        .pb-strip ul { margin: 6px 0; padding-left: 18px; }
        .pb-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #f0e7d7; color: var(--zkc); }
        .pb-badge.tutup { background: #f6dcdc; color: #8c2f2f; }
        .pb-badge.konfirmasi { background: #fdf0d5; color: #8a6d1a; }
        .pb-foot { border-top: 1px solid #e7dcc9; background: #f5efe3; }
        .pb-foot-in { max-width: 1120px; margin: 0 auto; padding: 24px 16px; display: flex; gap: 22px; flex-wrap: wrap; font-size: 14px; color: #57462f; }
        .pb-wa-float { position: fixed; right: 16px; bottom: 16px; z-index: 30; background: #25D366; color: #123; font-weight: 700; text-decoration: none; padding: 12px 18px; border-radius: 999px; box-shadow: 0 6px 18px rgba(0,0,0,.18); font-size: 14.5px; }
        .pb-field { margin-bottom: 12px; }
        .pb-field label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .pb-field input, .pb-field select, .pb-field textarea { width: 100%; padding: 9px 11px; border: 1px solid #d9cbb2; border-radius: 9px; font: inherit; background: #fff; box-sizing: border-box; }
        .pb-form2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 0 14px; }
        .pb-ok { background: #e9f4e4; border: 1px solid #bcd8ae; border-radius: 12px; padding: 16px; }
        .pb-err { background: #fbeaea; border: 1px solid #eec5c5; border-radius: 12px; padding: 12px 16px; }
        .pb-cek { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
        .pb-cek input { width: auto; margin-top: 3px; }
        @media (max-width: 640px) { .pb-hero h1 { font-size: 25px; } }
      `}</style>
      <header className="pb-head">
        <div className="pb-head-in">
          <Link className="pb-brand" href="/website">
            Ziel Kids Club &amp; Sekolah Alam Montessori
            <small>YAYASAN TUNAS PELITA CAKRAWALA INSANI · MALANG</small>
          </Link>
          <nav className="pb-nav" aria-label="Navigasi website">
            {NAV_PUBLIK.map(([href, label]) => (
              <Link key={href + label} href={href}>{label}</Link>
            ))}
            <Link className="pb-portal" href="/login">Masuk Portal</Link>
          </nav>
        </div>
      </header>
      <main className="pb-main">{children}</main>
      <footer className="pb-foot">
        <div className="pb-foot-in">
          <div style={{ flex: "1 1 260px" }}>
            <strong>Kontak &amp; Lokasi</strong>
            <p style={{ margin: "6px 0" }}>{ALAMAT_LEMBAGA}</p>
            <p style={{ margin: "6px 0" }}>
              Customer Service resmi: {NOMOR_CS}<br />
              <a href={MAPS_LINK} target="_blank" rel="noreferrer">Lihat peta lokasi</a>
            </p>
            <a className="pb-btn wa" href={WA_LINK} target="_blank" rel="noreferrer">Hubungi Admin via WhatsApp</a>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <strong>Portal</strong>
            <p style={{ margin: "6px 0" }}>
              Orang tua, guru, dan pengelola masuk lewat satu pintu resmi:<br />
              <Link href="/login">Masuk Portal</Link>
            </p>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <strong>Tumbuh Bersama.<br />Menerangi Masa Depan.</strong>
            <p style={{ margin: "6px 0" }}>Understanding Children. Strengthening Families. Learning Naturally. Growing Meaningfully.</p>
          </div>
        </div>
      </footer>
      <a className="pb-wa-float" href={WA_LINK} target="_blank" rel="noreferrer">WhatsApp Admin</a>
    </div>
  );
}
