"use client";

import { useEffect, useState } from "react";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, rupiahFmt, useApi, type AnyRow } from "@/components/module-ui";
import SkemaBiaya from "@/components/skema-biaya";

type Finance = { invoices: AnyRow[]; entries: AnyRow[]; monthIn: number; monthOut: number };
type Meta = {
  branches: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; full_name: string; position: string }>;
};
type Child = { id: string; full_name: string; branch_name: string };

function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function KeuanganPage() {
  const { data, error, reload } = useApi<Finance>("/api/finance");
  const [meta, setMeta] = useState<Meta>({ branches: [], staff: [] });
  const [branchId, setBranchId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [anak, setAnak] = useState<Child[]>([]);
  const [satu, setSatu] = useState({ child_id: "", period: nextMonth(), amount: "", reason: "" });
  const [gw, setGw] = useState<{ tersimpan: boolean; server_mask: string | null; client_key: string | null; sandbox: boolean; aktif: boolean; siap: boolean } | null>(null);
  const [gwForm, setGwForm] = useState({ server_key: "", client_key: "", sandbox: true, aktif: false });
  const [gwBusy, setGwBusy] = useState("");
  const [gwInfo, setGwInfo] = useState<{ ok: boolean; text: string } | null>(null);

  async function muatGateway() {
    const r = await fetch("/api/keuangan/gateway");
    const d = await r.json();
    if (d.ok) {
      setGw(d);
      setGwForm({ server_key: "", client_key: d.client_key || "", sandbox: d.sandbox, aktif: d.aktif });
    }
  }

  async function aksiGateway(aksi: "simpan" | "uji") {
    setGwBusy(aksi);
    setGwInfo(null);
    const r = await fetch("/api/keuangan/gateway", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi, ...gwForm }),
    });
    const d = await r.json();
    setGwBusy("");
    if (!d.ok) { setGwInfo({ ok: false, text: d.error || "Gagal." }); return; }
    setGwInfo({ ok: true, text: d.pesan || "Berhasil." });
    if (aksi === "simpan") await muatGateway();
  }

  useEffect(() => {
    fetch("/api/children")
      .then((r) => r.json())
      .then((d) => (d.ok ? setAnak(d.children) : null))
      .catch(() => null);
  }, []);
  useEffect(() => { void muatGateway(); }, []);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then((d) => {
      if (d.ok) {
        setMeta(d);
        if (d.branches.length > 0) setBranchId((p) => p || d.branches[0].id);
        if (d.staff.length > 0) setStaffId((p) => p || d.staff[0].id);
      }
    }).catch(() => null);
  }, []);

  async function sppMassal() {
    if (!branchId) { setFeedback("Pilih cabang dulu."); return; }
    setBusy(true);
    const res = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "spp_massal", branch_id: branchId }) });
    const d = await res.json();
    setBusy(false);
    setFeedback(d.ok ? `Tagihan SPP bulan ini dibuat untuk ${d.created} anak: ${d.names.join(", ") || "-"}.` : d.error);
    if (d.ok) reload();
  }

  async function tagihanSatu() {
    if (!satu.child_id || !satu.period) { setFeedback("Pilih anak dan periode dulu."); return; }
    setBusy(true);
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "tagihan_anak",
        child_id: satu.child_id,
        period_month: satu.period,
        amount: satu.amount,
        reason: satu.reason,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) {
      setFeedback(`Tagihan ${satu.period} dibuat: ${rupiahFmt(Number(d.amount))}.`);
      setSatu({ ...satu, amount: "", reason: "" });
      reload();
    } else {
      setFeedback(d.existing_id ? `${d.error} Buka tagihan itu: ${d.existing_id}` : d.error || "Gagal membuat tagihan.");
    }
  }

  async function batalBayar(invoiceId: string) {
    const alasan = window.prompt("Batalkan pembayaran tagihan ini? Tulis alasan:");
    if (alasan === null) return;
    setBusy(true);
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batal_bayar", invoice_id: invoiceId, reason: alasan }),
    });
    const d = await res.json();
    setBusy(false);
    setFeedback(d.ok ? "Pembayaran dibatalkan; kwitansi ditandai DIBATALKAN." : d.error);
    reload();
  }

  async function konfirmasi(invoiceId: string) {
    if (!staffId) { setFeedback("Pilih staf pengonfirmasi dulu (buat staf di Data Awal bila belum ada)."); return; }
    setBusy(true);
    const res = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "konfirmasi_bayar", invoice_id: invoiceId, confirmed_by: staffId }) });
    const d = await res.json();
    setBusy(false);
    setFeedback(d.ok ? `Pembayaran terkonfirmasi dan masuk Buku Kas. Total terbayar: ${rupiahFmt(d.paidTotal)}.` : d.error);
    if (d.ok) reload();
  }

  const openCount = data ? data.invoices.filter((i) => i.status !== "lunas").length : 0;

  return (
    <>
      <PageHead title="Keuangan" subtitle="Buku Kas, tagihan SPP, pembayaran, nota, dan payroll" />
      <ApiError error={error} />
      <SkemaBiaya />
      <KpiGrid items={[
        { label: "Pemasukan Bulan Ini", value: data ? rupiahFmt(data.monthIn) : "...", icon: "▦", tone: "tone-sage" },
        { label: "Pengeluaran Bulan Ini", value: data ? rupiahFmt(data.monthOut) : "...", icon: "▦", tone: "tone-peach" },
        { label: "Tagihan Terbuka", value: data ? openCount : "...", icon: "✎", tone: "tone-pink" },
        { label: "Entri Buku Kas Tampil", value: data ? data.entries.length : "...", icon: "▤", tone: "tone-sky" },
      ]} />
      <article className="card">
        <h2>Buat Tagihan SPP Bulan Ini (Massal)</h2>
        <p className="muted">Satu tagihan per anak aktif yang belum punya tagihan periode ini, nominal dari tarif SPP programnya. Anak tanpa tarif program dilewati.</p>
        <div className="row">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Cabang untuk tagihan massal">
            <option value="">Pilih cabang</option>
            {meta.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Staf pengonfirmasi pembayaran">
            <option value="">Pilih staf pengonfirmasi</option>
            {meta.staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name} · {s.position}</option>))}
          </select>
          <button className="btn" disabled={busy} onClick={sppMassal}>Buat Tagihan SPP</button>
        </div>
        {feedback ? <p className="notice" role="status" style={{ marginTop: 10 }}>{feedback}</p> : null}
      </article>
      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Buat Tagihan Per Anak</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Untuk satu anak dan periode tertentu (termasuk bulan depan). Nominal terisi dari tarif SPP program anak; kalau diubah, alasannya wajib dicatat.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="sa_anak">Anak *</label>
            <select id="sa_anak" value={satu.child_id} onChange={(e) => setSatu({ ...satu, child_id: e.target.value })}>
              <option value="">Pilih anak</option>
              {anak.map((c) => (<option key={c.id} value={c.id}>{c.full_name} · {c.branch_name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="sa_per">Periode (bulan) *</label>
            <input id="sa_per" type="month" value={satu.period} onChange={(e) => setSatu({ ...satu, period: e.target.value })} /></div>
          <div className="field"><label htmlFor="sa_amt">Nominal (kosongkan = tarif program)</label>
            <input id="sa_amt" type="number" min="0" placeholder="500000" value={satu.amount} onChange={(e) => setSatu({ ...satu, amount: e.target.value })} /></div>
          <div className="field"><label htmlFor="sa_al">Alasan perubahan nominal</label>
            <input id="sa_al" placeholder="Diskon saudara kandung" value={satu.reason} onChange={(e) => setSatu({ ...satu, reason: e.target.value })} /></div>
        </div>
        <button className="btn" type="button" disabled={busy} style={{ marginTop: 10 }} onClick={tagihanSatu}>
          Buat Tagihan Per Anak
        </button>
      </article>
      <KartuSemuaTagihan />
      <DataSection
        title="Tagihan Terbaru"
        rows={data ? data.invoices : null}
        emptyTitle="Belum ada tagihan"
        emptyBody="Buat tagihan SPP massal di atas setelah ada anak aktif dengan tarif program, atau tunggu tagihan dari alur pendaftaran."
        columns={[
          { key: "child_name", label: "Anak", render: (r) => <strong>{String(r.child_name || "-")}</strong> },
          { key: "description", label: "Keterangan" },
          { key: "period_month", label: "Periode", render: (r) => dateFmt(r.period_month) },
          { key: "invoice_number", label: "Nomor", render: (r) => <span className="muted">{String(r.invoice_number || "-")}</span> },
          { key: "amount", label: "Nominal", render: (r) => rupiahFmt(Number(r.amount || 0)) },
          { key: "paid_total", label: "Terbayar", render: (r) => rupiahFmt(Number(r.paid_total || 0)) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "aksi", label: "", render: (r) => (
            <div style={{ display: "flex", gap: 6 }}>
              <a className="btn small secondary" href={`/tagihan/${String(r.id)}/cetak`} target="_blank" rel="noreferrer">Cetak</a>
              {r.status === "lunas" ? (
                <>
                  <a className="btn small secondary" href={`/kwitansi/${String(r.id)}/cetak`} target="_blank" rel="noreferrer">Kwitansi</a>
                  <button className="btn small secondary" disabled={busy} onClick={() => batalBayar(String(r.id))}>Batalkan</button>
                </>
              ) : <button className="btn small" disabled={busy} onClick={() => konfirmasi(String(r.id))}>Konfirmasi Lunas</button>}
            </div>
          ) },
        ]}
      />
      <DataSection
        title="Buku Kas Terakhir"
        rows={data ? data.entries : null}
        emptyTitle="Buku Kas masih kosong"
        emptyBody="Setiap pemasukan dan pengeluaran tercatat di sini. Koreksi hanya lewat entri reversal yang tertaut, tidak pernah hapus."
        columns={[
          { key: "entry_date", label: "Tanggal", render: (r) => dateFmt(r.entry_date) },
          { key: "direction", label: "Arah", render: (r) => <StatusBadge status={r.direction === "masuk" ? "lunas" : "revisi"} /> },
          { key: "category", label: "Kategori" },
          { key: "description", label: "Keterangan" },
          { key: "invoice_number", label: "Nomor", render: (r) => <span className="muted">{String(r.invoice_number || "-")}</span> },
          { key: "amount", label: "Nominal", render: (r) => rupiahFmt(Number(r.amount || 0)) },
        ]}
      />
      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Payment Gateway — Midtrans</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Bila aktif, orang tua dapat membayar tagihan langsung dari Balita Connect (transfer bank, e-wallet, kartu).
          Status Lunas, Buku Kas, dan kwitansi berjalan otomatis dari notifikasi Midtrans. Pembayaran manual oleh staf tetap berjalan seperti biasa.
          Kunci diambil dari dashboard Midtrans sekolah dan tersimpan di database — tidak lewat chat dan hanya tampil tersamar.
        </p>
        <p>
          Status:{" "}
          {gw?.siap ? <span className="badge ok">Aktif{gw.sandbox ? " · mode Sandbox (uji)" : " · mode Produksi"}</span>
            : gw?.tersimpan ? <span className="badge warn">Kunci tersimpan, gateway belum diaktifkan</span>
            : <span className="badge">Belum diatur</span>}
          {gw?.server_mask ? <span className="muted"> · Server Key {gw.server_mask}</span> : null}
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="gw-server">Server Key Midtrans</label>
            <input id="gw-server" type="password" autoComplete="off" placeholder={gw?.tersimpan ? "Sudah tersimpan — isi hanya untuk mengganti" : "SB-Mid-server-… / Mid-server-…"}
              value={gwForm.server_key} onChange={(e) => setGwForm({ ...gwForm, server_key: e.target.value })} /></div>
          <div className="field"><label htmlFor="gw-client">Client Key Midtrans</label>
            <input id="gw-client" autoComplete="off" placeholder="SB-Mid-client-… / Mid-client-…"
              value={gwForm.client_key} onChange={(e) => setGwForm({ ...gwForm, client_key: e.target.value })} /></div>
          <div className="field"><label htmlFor="gw-mode">Mode</label>
            <select id="gw-mode" value={gwForm.sandbox ? "sandbox" : "produksi"} onChange={(e) => setGwForm({ ...gwForm, sandbox: e.target.value === "sandbox" })}>
              <option value="sandbox">Sandbox (uji coba)</option>
              <option value="produksi">Produksi (uang sungguhan)</option>
            </select></div>
          <div className="field"><label htmlFor="gw-aktif">Aktifkan</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input id="gw-aktif" type="checkbox" checked={gwForm.aktif} onChange={(e) => setGwForm({ ...gwForm, aktif: e.target.checked })} />
              Tampilkan tombol Bayar Sekarang di Balita Connect
            </label></div>
        </div>
        {gwInfo ? <p className={gwInfo.ok ? "notice ok" : "notice"} role="status">{gwInfo.text}</p> : null}
        <div className="row">
          <button type="button" className="btn" disabled={Boolean(gwBusy)} onClick={() => void aksiGateway("simpan")}>{gwBusy === "simpan" ? "Menyimpan…" : "Simpan Setelan"}</button>
          <button type="button" className="btn secondary" disabled={Boolean(gwBusy)} onClick={() => void aksiGateway("uji")}>{gwBusy === "uji" ? "Menguji…" : "Uji Server Key"}</button>
        </div>
        <p className="muted">
          Di dashboard Midtrans, atur Payment Notification URL ke <code>{"/api/payments/webhook"}</code> pada domain aplikasi ini
          (mis. https://balita.rotalogic.id/api/payments/webhook) supaya status lunas tercatat otomatis.
        </p>
      </div>
    </>
  );
}

type BarisTagihan = {
  id: string; invoice_number: string | null; status: string; description: string | null;
  amount: number; periode: string; due_date: string | null; child_name: string;
  class_name: string | null; paid_total: number; receipt_id: string | null;
};

function KartuSemuaTagihan() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [periode, setPeriode] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [hasil, setHasil] = useState<{ rows: BarisTagihan[]; total: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status) p.set("status", status);
      if (periode) p.set("periode", periode);
      p.set("halaman", String(halaman));
      fetch(`/api/keuangan/tagihan?${p.toString()}`)
        .then((r) => r.json())
        .then((d) => (d.ok ? setHasil({ rows: d.rows, total: d.total }) : setHasil({ rows: [], total: 0 })))
        .catch(() => setHasil({ rows: [], total: 0 }));
    }, 300);
    return () => clearTimeout(t);
  }, [q, status, periode, halaman]);

  const totalHalaman = hasil ? Math.max(1, Math.ceil(hasil.total / 25)) : 1;
  const LABEL: Record<string, string> = { belum_bayar: "Belum Bayar", menunggu_konfirmasi: "Sebagian / Menunggu", lunas: "Lunas", batal: "Batal" };

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Semua Tagihan</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Cari menurut nama anak atau nomor tagihan, saring menurut status dan periode — seluruh tagihan terjangkau dari sini.
      </p>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input aria-label="Cari tagihan" placeholder="Cari nama anak / nomor tagihan…" value={q}
          onChange={(e) => { setQ(e.target.value); setHalaman(1); }} style={{ flex: "1 1 240px" }} />
        <select aria-label="Status tagihan" value={status} onChange={(e) => { setStatus(e.target.value); setHalaman(1); }}>
          <option value="">Semua status</option>
          <option value="belum_bayar">Belum Bayar</option>
          <option value="menunggu_konfirmasi">Sebagian / Menunggu</option>
          <option value="lunas">Lunas</option>
          <option value="batal">Batal</option>
        </select>
        <input aria-label="Periode tagihan" type="month" value={periode} onChange={(e) => { setPeriode(e.target.value); setHalaman(1); }} />
      </div>
      {!hasil ? <p className="muted">Memuat…</p> : hasil.rows.length === 0 ? (
        <p className="muted">Tidak ada tagihan yang cocok dengan pencarian ini.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Anak</th><th>Nomor</th><th>Periode</th><th>Nominal</th><th>Terbayar</th><th>Sisa</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {hasil.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.child_name}</strong>{r.class_name ? <span className="muted"> · {r.class_name}</span> : null}</td>
                  <td className="muted">{r.invoice_number || "-"}</td>
                  <td>{r.periode}</td>
                  <td>{rupiahFmt(r.amount)}</td>
                  <td>{rupiahFmt(r.paid_total)}</td>
                  <td>{rupiahFmt(Math.max(0, r.amount - r.paid_total))}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a className="btn small secondary" href={`/tagihan/${r.id}/cetak`} target="_blank" rel="noreferrer">Cetak</a>
                    {r.status === "lunas" && r.receipt_id ? (
                      <a className="btn small secondary" href={`/kwitansi/${r.id}/cetak`} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>Kwitansi</a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
        <span className="muted">{hasil ? `${hasil.total} tagihan` : ""} · Halaman {halaman} dari {totalHalaman}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" className="btn small secondary" disabled={halaman <= 1} onClick={() => setHalaman(halaman - 1)}>Sebelumnya</button>
          <button type="button" className="btn small secondary" disabled={halaman >= totalHalaman} onClick={() => setHalaman(halaman + 1)}>Berikutnya</button>
        </span>
      </div>
    </article>
  );
}
