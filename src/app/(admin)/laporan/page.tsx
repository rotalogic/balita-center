"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, KpiGrid, dateFmt } from "@/components/module-ui";
import { tanggalPanjang, jamRapi } from "@/lib/format";

type Ref = { branches: Array<{ id: string; name: string }>; classes: Array<{ id: string; name: string; branch_id: string }> };
type Row = {
  id: string;
  report_date: string;
  tanggal: string;
  status: string;
  status_label: string;
  child_name: string;
  class_name: string | null;
  branch_name: string | null;
  teacher_name: string | null;
  photo_count: number;
  activity_count: number;
};
type Laporan = {
  filter: { dari: string; sampai: string; branch_id: string; class_id: string; status: string };
  ringkas: { total: number; terbit: number; menunggu: number; draft: number; anak: number };
  kehadiran: { hadir: number; total: number };
  reports: Row[];
};
type Log = {
  id: number;
  action: string;
  entity_table: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  waktu: string;
  aktor: string | null;
  aktor_email: string | null;
  peran: string | null;
  branch_name: string | null;
};
type Audit = { logs: Log[]; actions: Array<{ action: string; total: number }> };

const STATUS = [
  ["", "Semua status"],
  ["draft", "Draft"],
  ["menunggu_review", "Menunggu Review"],
  ["published", "Terbit"],
];

// Detail audit dibaca manusia: { anak: "Rara", perubahan: { mood: { dari, ke } } }
// menjadi baris "anak: Rara" dan "perubahan → mood: ceria → biasa".
function DetailAudit({ detail }: { detail: Record<string, unknown> | null }) {
  if (!detail || Object.keys(detail).length === 0) return <span className="muted">—</span>;
  const baris: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      baris.push(`${k}: ${v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")}`);
    } else if (typeof v === "object") {
      const dalam = Object.entries(v as Record<string, unknown>).map(([k2, v2]) => {
        if (v2 && typeof v2 === "object" && "dari" in (v2 as object)) {
          const d = v2 as { dari: unknown; ke: unknown };
          return `${k2}: ${String(d.dari ?? "-")} → ${String(d.ke ?? "-")}`;
        }
        return `${k2}: ${typeof v2 === "object" ? JSON.stringify(v2) : String(v2)}`;
      });
      baris.push(`${k} → ${dalam.join("; ")}`);
    } else {
      baris.push(`${k}: ${String(v)}`);
    }
  }
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
      {baris.slice(0, 6).map((b, i) => (<div key={i}>{b}</div>))}
    </div>
  );
}

function kueri(f: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

export default function LaporanPage() {
  const hariIni = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState(() => {
    const url = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("branch_id") : "";
    return { dari: `${hariIni.slice(0, 7)}-01`, sampai: hariIni, branch_id: url || "", class_id: "", status: "" };
  });
  const [data, setData] = useState<Laporan | null>(null);
  const [ref, setRef] = useState<Ref>({ branches: [], classes: [] });
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditFilter, setAuditFilter] = useState({ aktor: "", aksi: "", dari: "", sampai: "" });

  const load = useCallback(() => {
    fetch(`/api/reports?${kueri(filter)}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [filter]);

  const loadAudit = useCallback(() => {
    fetch(`/api/audit?${kueri(auditFilter)}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setAudit(d) : null))
      .catch(() => null);
  }, [auditFilter]);

  useEffect(load, [load]);
  useEffect(loadAudit, [loadAudit]);
  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => (d.ok ? setRef({ branches: d.branches, classes: d.classes }) : null))
      .catch(() => null);
  }, []);

  const kelasTersaring = useMemo(
    () => ref.classes.filter((k) => !filter.branch_id || k.branch_id === filter.branch_id),
    [ref.classes, filter.branch_id]
  );

  const unduh = (format: "csv" | "xlsx") => {
    window.location.href = `/api/reports?${kueri(filter)}&format=${format}`;
  };

  const set = (k: string, v: string) => setFilter((p) => ({ ...p, [k]: v, ...(k === "branch_id" ? { class_id: "" } : {}) }));

  return (
    <>
      <PageHead
        title="Laporan"
        subtitle="Filter, ringkasan, ekspor, dan jejak audit — semua angka mengikuti filter aktif"
        action={<Link className="btn secondary" href="/daily-reports">Buka Daily Reports</Link>}
      />
      <ApiError error={error} />

      <article className="card">
        <h2 style={{ marginTop: 0 }}>Filter</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="f_dari">Dari tanggal</label>
            <input id="f_dari" type="date" value={filter.dari} onChange={(e) => set("dari", e.target.value)} /></div>
          <div className="field"><label htmlFor="f_sampai">Sampai tanggal</label>
            <input id="f_sampai" type="date" value={filter.sampai} onChange={(e) => set("sampai", e.target.value)} /></div>
          <div className="field"><label htmlFor="f_branch">Cabang</label>
            <select id="f_branch" value={filter.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
              <option value="">Semua cabang</option>
              {ref.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="f_kelas">Kelas</label>
            <select id="f_kelas" value={filter.class_id} onChange={(e) => set("class_id", e.target.value)}>
              <option value="">Semua kelas</option>
              {kelasTersaring.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="f_status">Status</label>
            <select id="f_status" value={filter.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
            </select></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn small" onClick={() => unduh("csv")}>Unduh CSV</button>
          <button type="button" className="btn small" onClick={() => unduh("xlsx")}>Unduh XLSX</button>
          <button
            type="button"
            className="btn small secondary"
            onClick={() => {
              const reset = { dari: `${hariIni.slice(0, 7)}-01`, sampai: hariIni, branch_id: "", class_id: "", status: "" };
              setFilter(reset);
            }}
          >
            Bulan ini
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Nama berkas: laporan-harian_{filter.dari}_{filter.sampai}_{filter.branch_id ? "cabang-terpilih" : "semua-cabang"}
          </span>
        </div>
      </article>

      <KpiGrid items={[
        { label: "Total Laporan", value: data ? data.ringkas.total : "...", icon: "▤", tone: "tone-sky" },
        { label: "Terbit", value: data ? data.ringkas.terbit : "...", icon: "✓", tone: "tone-sage" },
        { label: "Menunggu Review", value: data ? data.ringkas.menunggu : "...", icon: "✎", tone: "tone-peach" },
        { label: "Draft", value: data ? data.ringkas.draft : "...", icon: "◍", tone: "tone-lavender" },
        { label: "Anak Terlayani", value: data ? data.ringkas.anak : "...", icon: "☺", tone: "tone-pink" },
        { label: "Hadir / Catatan Absensi", value: data ? `${data.kehadiran.hadir}/${data.kehadiran.total}` : "...", icon: "☑", tone: "tone-sage" },
      ]} />

      <article className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Daftar Laporan ({data?.reports.length ?? 0})</h2>
        {data && data.reports.length === 0 ? (
          <p className="muted">Tidak ada laporan pada filter ini. Coba lebarkan rentang tanggal atau pilih “Semua status”.</p>
        ) : (
          <table>
            <thead><tr><th>Tanggal</th><th>Anak</th><th>Kelas / Cabang</th><th>Guru</th><th>Foto</th><th>Aktivitas</th><th>Status</th></tr></thead>
            <tbody>
              {(data?.reports || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.tanggal}</td>
                  <td><Link href={`/daily-reports/${r.id}`}><strong>{r.child_name}</strong></Link></td>
                  <td>{r.class_name || "-"}<div className="muted">{r.branch_name || ""}</div></td>
                  <td>{r.teacher_name || "-"}</td>
                  <td>{r.photo_count}</td>
                  <td>{r.activity_count}</td>
                  <td><StatusBadge status={r.status_label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Jejak Audit ({audit?.logs.length ?? 0})</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="a_aktor">Aktor</label>
            <input id="a_aktor" placeholder="Nama atau email" value={auditFilter.aktor} onChange={(e) => setAuditFilter({ ...auditFilter, aktor: e.target.value })} /></div>
          <div className="field"><label htmlFor="a_aksi">Aksi</label>
            <input id="a_aksi" list="daftar-aksi" placeholder="mis. leave.approve" value={auditFilter.aksi} onChange={(e) => setAuditFilter({ ...auditFilter, aksi: e.target.value })} />
            <datalist id="daftar-aksi">
              {(audit?.actions || []).map((a) => (<option key={a.action} value={a.action}>{a.total}×</option>))}
            </datalist></div>
          <div className="field"><label htmlFor="a_dari">Dari</label>
            <input id="a_dari" type="date" value={auditFilter.dari} onChange={(e) => setAuditFilter({ ...auditFilter, dari: e.target.value })} /></div>
          <div className="field"><label htmlFor="a_sampai">Sampai</label>
            <input id="a_sampai" type="date" value={auditFilter.sampai} onChange={(e) => setAuditFilter({ ...auditFilter, sampai: e.target.value })} /></div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Catatan audit tidak bisa diubah atau dihapus dari aplikasi.</p>
        {audit && audit.logs.length === 0 ? (
          <p className="muted">Belum ada catatan pada filter ini.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Waktu</th><th>Aktor</th><th>Peran</th><th>Aksi</th><th>Entitas</th><th>Ringkasan</th></tr></thead>
              <tbody>
                {(audit?.logs || []).map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {dateFmt(l.waktu)} <span className="muted">{jamRapi(l.waktu)} WIB</span>
                    </td>
                    <td>{l.aktor || <span className="muted">(anonim)</span>}<div className="muted">{l.aktor_email || ""}</div></td>
                    <td>{l.peran || "-"}</td>
                    <td><code>{l.action}</code></td>
                    <td>{l.entity_table}<div className="muted">{l.branch_name || ""}</div></td>
                    <td style={{ maxWidth: 320 }}>
                      <DetailAudit detail={l.detail} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
