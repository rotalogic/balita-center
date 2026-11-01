"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/chrome";

export type AnyRow = Record<string, string | number | boolean | null>;

// Mengambil satu endpoint JSON sekali muat untuk halaman modul.
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d as T) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [url, reloadKey]);
  return { data, error, reload: () => setReloadKey((k) => k + 1) };
}

export function KpiGrid({ items }: { items: Array<{ label: string; value: string | number; icon: string; tone: string }> }) {
  return (
    <section className="grid kpi" aria-label="Ringkasan modul">
      {items.map((item) => (
        <article className="card kpi-card" key={item.label}>
          <div className={`kpi-icon ${item.tone}`} aria-hidden="true">{item.icon}</div>
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value" style={{ fontSize: 24 }}>{item.value}</div>
        </article>
      ))}
    </section>
  );
}

export function DataSection({
  title, rows, columns, emptyTitle, emptyBody,
}: {
  title: string;
  rows: AnyRow[] | null;
  columns: Array<{ key: string; label: string; render?: (row: AnyRow) => React.ReactNode }>;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <article className="card">
      <h2>{title}</h2>
      {rows === null ? <LoadingState /> : rows.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>{columns.map((c) => (<th key={c.key}>{c.label}</th>))}</tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {columns.map((c) => (<td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "-")}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function ApiError({ error }: { error: string | null }) {
  return error ? <ErrorState message={error} /> : null;
}

export const rupiahFmt = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export const dateFmt = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
