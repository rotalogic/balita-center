"use client";

import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function ConnectPembayaranPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Pembayaran" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Pembayaran" /><LoadingState /></>);

  const open = data.invoices.filter((i) => i.status !== "lunas");
  const openTotal = open.reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.paid_total || 0)), 0);

  return (
    <>
      <PageHead title="Pembayaran" subtitle="Tagihan SPP dan biaya sekolah anak Anda" />
      <section className="grid three">
        <article className="card kpi-card"><div className="kpi-label">Tagihan Terbuka</div><div className="kpi-value">{open.length}</div></article>
        <article className="card kpi-card"><div className="kpi-label">Total Belum Dibayar</div><div className="kpi-value" style={{ fontSize: 22 }}>{rupiah(openTotal)}</div></article>
        <article className="card kpi-card"><div className="kpi-label">Total Tagihan Tercatat</div><div className="kpi-value">{data.invoices.length}</div></article>
      </section>
      {data.invoices.length === 0 ? (
        <EmptyState title="Belum ada tagihan" body="Tagihan SPP dibuat dari modul Keuangan (termasuk pembuatan massal per bulan) dan tampil di sini untuk anak Anda." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Periode</th><th>Keterangan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Terbayar</th><th>Status</th></tr></thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={String(i.id)}>
                  <td><strong>{String(i.period_month || "-")}</strong></td>
                  <td>{String(i.description || "Tagihan SPP")}</td>
                  <td>{String(i.due_date || "-")}</td>
                  <td>{rupiah(Number(i.amount || 0))}</td>
                  <td>{rupiah(Number(i.paid_total || 0))}</td>
                  <td><StatusBadge status={String(i.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="notice">Pembayaran online (payment gateway) belum tersambung di paket ini. Konfirmasi pembayaran dicatat staf di modul Keuangan dan status tagihan di sini berubah mengikuti data yang sama.</p>
    </>
  );
}
