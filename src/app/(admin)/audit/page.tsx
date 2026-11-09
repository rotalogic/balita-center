"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";

type Log = {
  id: string; waktu: string; action: string; entity_table: string | null; entity_id: string | null;
  detail: Record<string, unknown> | null; aktor: string | null; peran: string[] | null;
  cabang: string | null; label: string | null;
};

const jam = (waktu: string) => (waktu || "").slice(11, 16);
const tanggal = (waktu: string) => (waktu || "").slice(0, 10);

// Detail audit disimpan sebagai JSON mentah: stempel waktu ISO dan UUID
// panjang membuat sulit dibaca. Rapikan di tampilan: waktu menjadi format
// WIB yang terbaca, UUID dipersingkat, kunci umum diberi label Indonesia.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FMT_WAKTU = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const FMT_TANGGAL = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" });
const LABEL_KUNCI: Record<string, string> = {
  child_id: "ID anak", branch_id: "ID cabang", invoice_id: "ID tagihan",
  report_id: "ID laporan", user_id: "ID pengguna", staff_id: "ID staf",
  class_id: "ID kelas", cycle_id: "ID siklus", lead_id: "ID lead",
  dari: "dari", ke: "ke", status: "status", nominal: "nominal",
  nomor: "nomor", tagihan: "tagihan", alasan: "alasan",
};
const labelKunci = (k: string) => LABEL_KUNCI[k] || k.replace(/_/g, " ");
function rapikan(v: unknown): string {
  if (typeof v === "string") {
    if (UUID_RE.test(v)) return `${v.slice(0, 8)}…`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return `${FMT_WAKTU.format(d)} WIB`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00+07:00`);
      if (!Number.isNaN(d.getTime())) return FMT_TANGGAL.format(d);
    }
  }
  return String(v);
}

function Detail({ detail }: { detail: Record<string, unknown> | null }) {
  if (!detail || Object.keys(detail).length === 0) return <span className="muted">—</span>;
  const baris: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") {
      const isi = Object.entries(v as Record<string, unknown>).map(([k2, v2]) => {
        if (v2 && typeof v2 === "object" && "dari" in (v2 as object) && "ke" in (v2 as object)) {
          const d = v2 as { dari: unknown; ke: unknown };
          return `${labelKunci(k2)}: ${d.dari == null ? "-" : rapikan(d.dari)} → ${d.ke == null ? "-" : rapikan(d.ke)}`;
        }
        return v2 && typeof v2 === "object" ? `${labelKunci(k2)}: ${JSON.stringify(v2)}` : `${labelKunci(k2)}: ${rapikan(v2)}`;
      });
      baris.push([labelKunci(k), isi.join("; ")]);
    } else {
      baris.push([labelKunci(k), rapikan(v)]);
    }
  }
  if (baris.length === 0) return <span className="muted">—</span>;
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: 12 }}>{baris[0][0]}: {baris[0][1]}</summary>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        {baris.map(([k, v]) => (
          <div key={k}><span className="muted">{k}</span>: {v}</div>
        ))}
      </div>
    </details>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ aktor: "", aksi: "", entity: "", dari: "", sampai: "", q: "" });
  const [page, setPage] = useState(1);

  const muat = useCallback(async (nomor: number, f: typeof filter) => {
    const qs = new URLSearchParams({ page: String(nomor), per: "50" });
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    setLogs(null);
    const res = await fetch(`/api/audit?${qs.toString()}`);
    const d = await res.json();
    if (d.ok) {
      setLogs(d.logs);
      setTotal(d.total);
      setHalaman(d.halaman);
      setError(null);
    } else {
      setError(d.error || "Gagal memuat jejak audit.");
      setLogs([]);
    }
  }, []);

  useEffect(() => { muat(page, filter); }, [page, muat]); // eslint-disable-line react-hooks/exhaustive-deps

  const terapkan = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    muat(1, filter);
  };

  const tautanCsv = () => {
    const qs = new URLSearchParams({ format: "csv", per: "200" });
    Object.entries(filter).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return `/api/audit?${qs.toString()}`;
  };

  return (
    <>
      <PageHead
        title="Jejak Audit"
        subtitle="Siapa melakukan apa, kapan (WIB). Dipakai untuk menyelidiki perubahan data."
        action={<a className="btn secondary" href={tautanCsv()}>Ekspor CSV</a>}
      />

      <form className="card" onSubmit={terapkan}>
        <div className="form-grid">
          <div className="field"><label htmlFor="aktor">Aktor</label>
            <input id="aktor" placeholder="nama pengguna" value={filter.aktor}
              onChange={(e) => setFilter({ ...filter, aktor: e.target.value })} /></div>
          <div className="field"><label htmlFor="aksi">Aksi</label>
            <input id="aksi" placeholder="mis. child.soft_delete" value={filter.aksi}
              onChange={(e) => setFilter({ ...filter, aksi: e.target.value })} /></div>
          <div className="field"><label htmlFor="entity">Entitas</label>
            <select id="entity" value={filter.entity} onChange={(e) => setFilter({ ...filter, entity: e.target.value })}>
              <option value="">Semua</option>
              {["children", "daily_reports", "invoices", "users", "leads", "bot_knowledge_entries", "leave_requests", "auth"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select></div>
          <div className="field"><label htmlFor="dari">Dari tanggal</label>
            <input id="dari" type="date" value={filter.dari} onChange={(e) => setFilter({ ...filter, dari: e.target.value })} /></div>
          <div className="field"><label htmlFor="sampai">Sampai tanggal</label>
            <input id="sampai" type="date" value={filter.sampai} onChange={(e) => setFilter({ ...filter, sampai: e.target.value })} /></div>
          <div className="field"><label htmlFor="q">Cari teks</label>
            <input id="q" placeholder="isi detail / id" value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })} /></div>
        </div>
        <button className="btn" type="submit">Terapkan filter</button>
      </form>

      <p className="muted" style={{ marginTop: 12 }}>
        {total} entri · halaman {page} dari {halaman}
      </p>

      {error ? <ErrorState message={error} /> : null}
      {!logs ? <LoadingState /> : logs.length === 0 ? (
        <EmptyState title="Tidak ada entri" body="Coba longgarkan filter atau rentang tanggal." />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {tanggal(l.waktu)} <span className="muted">{jam(l.waktu)} WIB</span>
                  </td>
                  <td>
                    <strong>{l.aktor || "Sistem"}</strong>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {(l.peran || []).join(", ") || "-"}{l.cabang ? ` · ${l.cabang}` : ""}
                    </div>
                  </td>
                  <td><code style={{ fontSize: 12 }}>{l.action}</code></td>
                  <td style={{ fontSize: 12 }}>
                    {l.label || l.entity_table || "-"}
                    <div className="muted" style={{ fontSize: 11 }}>{l.entity_table}{l.entity_id ? ` · ${String(l.entity_id).slice(0, 8)}` : ""}</div>
                  </td>
                  <td style={{ maxWidth: 360 }}><Detail detail={l.detail} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>← Sebelumnya</button>
        <button className="btn secondary" disabled={page >= halaman} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
      </div>
    </>
  );
}
