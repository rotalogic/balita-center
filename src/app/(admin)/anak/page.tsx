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

export default function AnakPage() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/children?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => (data.ok ? setChildren(data.children) : setError(data.error)))
        .catch(() => setError("Tidak dapat menghubungi server."));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <PageHead
        title="Data Anak Didik"
        subtitle="Kelola seluruh data anak didik di Balita Center"
        action={<Link className="btn" href="/anak/tambah">+ Tambah Anak</Link>}
      />
      <div className="toolbar card">
        <label className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama anak atau orang tua..." aria-label="Cari anak" />
        </label>
        {children ? <span className="muted">{children.length} anak tampil</span> : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!children && !error ? <LoadingState /> : null}
      {children && children.length === 0 ? (
        <EmptyState title="Belum ada data anak" body="Database masih kosong atau pencarian tidak menemukan hasil. Tambahkan anak pertama lewat tombol Tambah Anak, setelah data awal cabang, program, dan kelas dibuat." />
      ) : null}
      {children && children.length > 0 ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Foto</th><th>Nama Anak</th><th>Kelas</th><th>Tanggal Lahir</th><th>Usia</th><th>Orang Tua</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {children.map((child, i) => (
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
