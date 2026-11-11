"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { LencanaKategori, LencanaLabel } from "@/components/lencana-anak";

type Child = {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  status: string;
  branch_name: string;
  class_name: string | null;
  guardian_name: string | null;
  kategori_program: string;
  label_status: string;
};

const TONES = ["tone-sky", "tone-pink", "tone-sage", "tone-peach", "tone-lavender"];

function ageLabel(birth: string | null): string {
  if (!birth) return "-";
  const born = new Date(birth);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years > 0 ? `${years} tahun ${rest} bulan` : `${rest} bulan`;
}

const STATUS_FILTERS = ["", "aktif", "cuti", "lulus", "keluar", "alumni"];

export default function AnakPage() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [all, setAll] = useState<Child[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [mode, setMode] = useState<"aktif" | "sampah">("aktif");
  const [sampah, setSampah] = useState<Array<Record<string, unknown>> | null>(null);
  const [sibukPulih, setSibukPulih] = useState("");

  async function muatSampah() {
    setSampah(null);
    const r = await fetch("/api/children?trash=1");
    const d = await r.json();
    if (d.ok) setSampah(d.children as Array<Record<string, unknown>>);
    else setError(d.error || "Sampah hanya dapat dibuka Super Admin.");
  }

  async function pulihkan(id: string) {
    setSibukPulih(id);
    const r = await fetch(`/api/children/${id}/sampah`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }),
    });
    const d = await r.json();
    setSibukPulih("");
    if (!d.ok) { setError(d.error || "Gagal memulihkan."); return; }
    await muatSampah();
  }

  useEffect(() => {
    fetch("/api/children")
      .then((r) => r.json())
      .then((data) => (data.ok ? setAll(data.children) : null))
      .catch(() => null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/children?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => (data.ok ? setChildren(data.children) : setError(data.error)))
        .catch(() => setError("Tidak dapat menghubungi server."));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const shown = children
    ? children.filter((c) => (!statusFilter || c.status === statusFilter) && (!kategoriFilter || c.kategori_program === kategoriFilter))
    : null;
  const boys = all.filter((c) => c.gender === "laki_laki").length;
  const girls = all.filter((c) => c.gender === "perempuan").length;
  const classCount = new Set(all.map((c) => c.class_name).filter(Boolean)).size;

  return (
    <>
      <PageHead
        title="Data Anak Didik"
        subtitle="Kelola seluruh data anak didik di Balita Center"
        action={<Link className="btn" href="/anak/tambah">+ Tambah Anak</Link>}
      />
      <section className="grid kpi" aria-label="Ringkasan anak didik">
        <article className="card kpi-card"><div className="kpi-icon tone-sky" aria-hidden="true">☺</div><div className="kpi-label">Total Anak</div><div className="kpi-value">{all.length}</div></article>
        <article className="card kpi-card"><div className="kpi-icon tone-sky" aria-hidden="true">♂</div><div className="kpi-label">Laki-laki</div><div className="kpi-value">{boys}</div></article>
        <article className="card kpi-card"><div className="kpi-icon tone-pink" aria-hidden="true">♀</div><div className="kpi-label">Perempuan</div><div className="kpi-value">{girls}</div></article>
        <article className="card kpi-card"><div className="kpi-icon tone-sage" aria-hidden="true">▤</div><div className="kpi-label">Kelas Terisi</div><div className="kpi-value">{classCount}</div></article>
      </section>
      <div className="toolbar card">
        <label className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama anak atau orang tua..." aria-label="Cari anak" />
        </label>
        <div className="tab-row" role="group" aria-label="Filter status anak">
          {STATUS_FILTERS.map((s) => (
            <button key={s || "semua"} type="button" className={statusFilter === s ? "tab-pill active" : "tab-pill"} onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s}>
              {s === "" ? "Semua" : s}
            </button>
          ))}
        </div>
        <div className="tab-row" role="group" aria-label="Filter kategori program">
          {["", "ZKC", "SAM"].map((k) => (
            <button key={k || "semua-kat"} type="button" className={kategoriFilter === k ? "tab-pill active" : "tab-pill"} onClick={() => setKategoriFilter(k)} aria-pressed={kategoriFilter === k}>
              {k === "" ? "Semua Rumah" : k === "ZKC" ? "Ziel Kids Club" : "Sekolah Alam Montessori"}
            </button>
          ))}
        </div>
        {shown ? <span className="muted">{shown.length} anak tampil</span> : null}
        <button type="button" className={mode === "sampah" ? "tab-pill active" : "tab-pill"}
          onClick={() => { if (mode === "sampah") { setMode("aktif"); } else { setMode("sampah"); void muatSampah(); } }} aria-pressed={mode === "sampah"}>
          🗑 Sampah
        </button>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!children && !error ? <LoadingState /> : null}
      {mode === "aktif" && shown && shown.length === 0 ? (
        <EmptyState title="Belum ada data anak" body="Database masih kosong atau pencarian tidak menemukan hasil. Tambahkan anak pertama lewat tombol Tambah Anak, setelah data awal cabang, program, dan kelas dibuat." />
      ) : null}
      {mode === "sampah" ? (
        <div className="card table-wrap">
          {!sampah ? <LoadingState /> : sampah.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>Sampah kosong. Anak yang dipindahkan ke sampah tampil di sini dan dapat dipulihkan Super Admin.</p>
          ) : (
            <table>
              <thead><tr><th>Nama Anak</th><th>Cabang</th><th>Dipindahkan</th><th>Oleh</th><th>Alasan</th><th></th></tr></thead>
              <tbody>
                {sampah.map((c) => (
                  <tr key={String(c.id)}>
                    <td><strong>{String(c.full_name)}</strong></td>
                    <td>{String(c.branch_name || "-")}</td>
                    <td>{c.deleted_at ? new Date(String(c.deleted_at)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</td>
                    <td>{String(c.oleh || "-")}</td>
                    <td>{String(c.deleted_reason || "-")}</td>
                    <td><button type="button" className="btn small secondary" disabled={sibukPulih === String(c.id)} onClick={() => void pulihkan(String(c.id))}>{sibukPulih === String(c.id) ? "Memulihkan…" : "Pulihkan"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
      {mode === "aktif" && shown && shown.length > 0 ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Foto</th><th>Nama Anak</th><th>Kelas</th><th>Tanggal Lahir</th><th>Usia</th><th>Orang Tua</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((child, i) => (
                <tr key={child.id}>
                  <td><span className={`child-photo ${TONES[i % TONES.length]}`}>{child.full_name.charAt(0)}</span></td>
                  <td><strong>{child.full_name}</strong><div className="muted">{child.branch_name}</div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6 }}><LencanaKategori kategori={child.kategori_program} /><LencanaLabel label={child.label_status} /></div></td>
                  <td>{child.class_name || "-"}</td>
                  <td>{child.birth_date ? new Date(child.birth_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</td>
                  <td>{ageLabel(child.birth_date)}</td>
                  <td>{child.guardian_name || "-"}</td>
                  <td><StatusBadge status={child.status} /></td>
                  <td><Link className="btn small secondary" href={`/anak/${child.id}`}>Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
