"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";

type Child = {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  status: string;
  branch_name: string;
  class_name: string | null;
  guardian_name: string | null;
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

  const shown = children ? children.filter((c) => !statusFilter || c.status === statusFilter) : null;
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
        {shown ? <span className="muted">{shown.length} anak tampil</span> : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!children && !error ? <LoadingState /> : null}
      {shown && shown.length === 0 ? (
        <EmptyState title="Belum ada data anak" body="Database masih kosong atau pencarian tidak menemukan hasil. Tambahkan anak pertama lewat tombol Tambah Anak, setelah data awal cabang, program, dan kelas dibuat." />
      ) : null}
      {shown && shown.length > 0 ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Foto</th><th>Nama Anak</th><th>Kelas</th><th>Tanggal Lahir</th><th>Usia</th><th>Orang Tua</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((child, i) => (
                <tr key={child.id}>
                  <td><span className={`child-photo ${TONES[i % TONES.length]}`}>{child.full_name.charAt(0)}</span></td>
                  <td><strong>{child.full_name}</strong><div className="muted">{child.branch_name}</div></td>
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
