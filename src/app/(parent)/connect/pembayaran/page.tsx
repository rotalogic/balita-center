"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

type SnapWindow = Window & { snap?: { pay: (token: string, opsi: Record<string, () => void>) => void } };

export default function ConnectPembayaranPage() {
  const { data, error } = useConnect();
  const [sibuk, setSibuk] = useState("");

  // Muat Snap.js Midtrans sekali bila gateway aktif.
  useEffect(() => {
    if (!data?.gateway?.aktif || !data.gateway.client_key) return;
    if (document.querySelector("script[data-snap]")) return;
    const s = document.createElement("script");
    s.src = data.gateway.sandbox ? "https://app.sandbox.midtrans.com/snap/snap.js" : "https://app.midtrans.com/snap/snap.js";
    s.setAttribute("data-client-key", data.gateway.client_key);
    s.setAttribute("data-snap", "1");
    document.body.appendChild(s);
  }, [data]);

  if (error) return (<><PageHead title="Pembayaran" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Pembayaran" /><LoadingState /></>);

  const open = data.invoices.filter((i) => i.status !== "lunas");
  const openTotal = open.reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.paid_total || 0)), 0);
  const gatewayAktif = Boolean(data.gateway?.aktif);

  async function bayar(id: string) {
    setSibuk(id);
    try {
      const r = await fetch("/api/connect/bayar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: id }),
      });
      const d = await r.json();
      if (!d.ok) { window.alert(d.error || "Gagal memulai pembayaran."); return; }
      const snap = (window as SnapWindow).snap;
      if (!snap) { window.alert("Halaman pembayaran belum termuat. Coba lagi sebentar lagi."); return; }
      snap.pay(String(d.token), {
        onSuccess: () => window.location.reload(),
        onPending: () => window.location.reload(),
        onError: () => window.alert("Pembayaran gagal atau dibatalkan. Tagihan Anda tidak berubah."),
        onClose: () => undefined,
      });
    } finally {
      setSibuk("");
    }
  }

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
            <thead><tr><th>Periode</th><th>Keterangan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Terbayar</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={String(i.id)}>
                  <td><strong>{String(i.period_month || "-")}</strong></td>
                  <td>{String(i.description || "Tagihan SPP")}</td>
                  <td>{String(i.due_date || "-")}</td>
                  <td>{rupiah(Number(i.amount || 0))}</td>
                  <td>{rupiah(Number(i.paid_total || 0))}</td>
                  <td><StatusBadge status={String(i.status)} /></td>
                  <td>
                    {String(i.status) === "lunas" ? (
                      <a className="btn small secondary" href={`/kwitansi/${String(i.id)}/cetak`} target="_blank" rel="noreferrer">Lihat Kwitansi</a>
                    ) : gatewayAktif && String(i.status) !== "batal" ? (
                      <button type="button" className="btn small" disabled={sibuk === String(i.id)} onClick={() => void bayar(String(i.id))}>
                        {sibuk === String(i.id) ? "Menyiapkan…" : "Bayar Sekarang"}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {gatewayAktif ? (
        <p className="notice">Pembayaran online aktif: klik <strong>Bayar Sekarang</strong> untuk membayar via transfer bank, e-wallet, atau kartu melalui Midtrans. Status tagihan dan kwitansi terbit otomatis begitu pembayaran berhasil. Pembayaran manual via administrasi tetap diterima.</p>
      ) : (
        <p className="notice">Pembayaran online belum diaktifkan sekolah. Silakan bayar via transfer ke Virtual Account sekolah atau tunai/QRIS di administrasi — konfirmasi dicatat staf di modul Keuangan dan status tagihan di sini berubah mengikuti data yang sama. Kwitansi resmi dapat dibuka dari tombol Lihat Kwitansi pada tagihan yang sudah lunas.</p>
      )}
    </>
  );
}
