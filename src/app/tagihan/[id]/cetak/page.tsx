import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { tanggalPanjang } from "@/lib/format";
import { TombolCetak } from "@/components/tombol-cetak";

export const dynamic = "force-dynamic";

const rupiah = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

const LABEL_STATUS: Record<string, string> = {
  belum_bayar: "BELUM BAYAR",
  menunggu_konfirmasi: "MENUNGGU KONFIRMASI",
  lunas: "LUNAS",
  batal: "DIBATALKAN",
};

// Halaman cetak tagihan. PDF dihasilkan oleh dialog cetak peramban
// (Ctrl/Cmd+P → Simpan sebagai PDF) — tanpa pustaka PDF tambahan.
export default async function CetakTagihan({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/tagihan/${params.id}/cetak`)}`);

  const rows = await query<{
    id: string; invoice_number: string | null; period_month: string; description: string | null;
    amount: string; status: string; due_date: string | null; created_on: string;
    child_name: string | null; class_name: string | null; guardian_name: string | null;
    branch_name: string; branch_city: string | null;
  }>(
    `SELECT i.id, i.invoice_number, i.period_month, i.description, i.amount, i.status, i.due_date,
            to_char(i.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS created_on,
            c.full_name AS child_name,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name,
            (SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
              WHERE cg.child_id = c.id ORDER BY cg.is_primary DESC LIMIT 1) AS guardian_name,
            b.name AS branch_name, b.city AS branch_city
       FROM invoices i
       JOIN branches b ON b.id = i.branch_id
       LEFT JOIN children c ON c.id = i.child_id
      WHERE i.id = $1::uuid`,
    [params.id]
  );
  const t = rows[0];
  if (!t) notFound();

  const lunas = t.status === "lunas";

  return (
    <main className="tagihan-wrap">
      <style>{`
        .tagihan-wrap { background:#eef1f6; min-height:100vh; padding:24px 12px; font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color:#16202e; }
        .lembar { max-width:760px; margin:0 auto; background:#fff; border-radius:12px; padding:32px 36px; box-shadow:0 10px 30px rgba(16,24,40,.08); }
        .baris { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
        .merek { font-size:13px; letter-spacing:.14em; font-weight:700; color:#3c5a8a; }
        .cabang { font-size:12px; color:#5b6b82; margin-top:2px; }
        .judul { font-size:26px; font-weight:800; margin:18px 0 2px; letter-spacing:.02em; }
        .sub { font-size:12px; color:#5b6b82; }
        .nomor { font-size:13px; color:#16202e; margin-top:14px; }
        .nomor b { font-weight:700; }
        .pil { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.06em; padding:4px 10px; border-radius:999px; background:#fdeceb; color:#b42318; border:1px solid #f6c7c2; }
        .pil.lunas { background:#e8f6ee; color:#027a48; border-color:#b7e4c7; }
        .kotak { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:14px; margin:22px 0 6px; padding:16px 0; border-top:1px solid #e6eaf1; border-bottom:1px solid #e6eaf1; }
        .kotak div span { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; margin-bottom:4px; }
        .kotak div strong { font-size:13px; font-weight:600; }
        h3 { font-size:13px; margin:24px 0 10px; text-transform:uppercase; letter-spacing:.08em; color:#3c5a8a; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; border-bottom:1px solid #e6eaf1; padding:8px 0; }
        td { padding:10px 0; border-bottom:1px solid #f1f4f9; }
        td.kanan, th.kanan { text-align:right; }
        .total { display:flex; justify-content:space-between; padding:14px 0; font-size:15px; font-weight:800; }
        .catatan { font-size:12px; color:#4a5b70; line-height:1.6; }
        .kaki { margin-top:26px; padding-top:14px; border-top:1px dashed #dfe5ee; font-size:11px; color:#7a8798; line-height:1.6; }
        .aksi { max-width:760px; margin:0 auto 14px; display:flex; gap:8px; justify-content:flex-end; }
        .aksi button, .aksi a { font:inherit; font-size:13px; padding:8px 14px; border-radius:8px; border:1px solid #c9d3e0; background:#fff; cursor:pointer; text-decoration:none; color:#16202e; }
        .aksi button.utama { background:#2f5d9e; border-color:#2f5d9e; color:#fff; }
        @media print {
          @page { size:A4; margin:16mm; }
          .tagihan-wrap { background:#fff; padding:0; }
          .lembar { box-shadow:none; border-radius:0; padding:0; max-width:none; }
          .aksi { display:none; }
        }
      `}</style>

      <div className="aksi">
        <a href="/keuangan">Kembali</a>
        <TombolCetak />
      </div>

      <div className="lembar">
        <div className="baris">
          <div>
            <div className="merek">BALITA CENTER</div>
            <div className="cabang">
              Montessori &amp; Childcare — Cabang {t.branch_name}
              {t.branch_city ? ` (${t.branch_city})` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="judul">TAGIHAN SPP</div>
            <div className="sub">Terkirim otomatis ke wali</div>
          </div>
        </div>

        <div className="nomor">
          Nomor Tagihan: <b>{t.invoice_number || "—"}</b>{" "}
          <span className={`pil ${lunas ? "lunas" : ""}`}>{LABEL_STATUS[t.status] || t.status}</span>
        </div>

        <div className="kotak">
          <div>
            <span>Ditagihkan kepada</span>
            <strong>{t.guardian_name || "—"}</strong>
            {t.child_name ? <div className="sub">Wali dari {t.child_name}</div> : null}
          </div>
          <div>
            <span>Anak / Kelas</span>
            <strong>{t.child_name || "—"}</strong>
            <div className="sub">{t.class_name || "—"}</div>
          </div>
          <div>
            <span>Tanggal terbit</span>
            <strong>{tanggalPanjang(t.created_on)}</strong>
          </div>
          <div>
            <span>Jatuh tempo</span>
            <strong>{t.due_date ? tanggalPanjang(t.due_date) : "—"}</strong>
          </div>
        </div>

        <h3>Rincian</h3>
        <table>
          <thead>
            <tr><th>Keterangan</th><th className="kanan">Jumlah</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{t.description || `SPP Program — ${tanggalPanjang(t.period_month)}`}</td>
              <td className="kanan">{rupiah(Number(t.amount))}</td>
            </tr>
          </tbody>
        </table>

        <div className="total">
          <span>Total yang harus dibayar</span>
          <span>{rupiah(Number(t.amount))}</span>
        </div>

        <h3>Cara Pembayaran</h3>
        <p className="catatan">
          Transfer ke Virtual Account sekolah atau tunai/QRIS di administrasi Cabang {t.branch_name}. Setelah
          pembayaran tercatat, kwitansi resmi terbit otomatis dan terkirim ke Balita Connect wali.
        </p>
        <p className="catatan">
          Pengingat otomatis: saat tagihan terbit, 3 hari sebelum jatuh tempo, dan 1 hari setelah jatuh tempo bila
          belum lunas — berhenti sendiri begitu pembayaran tercatat.
        </p>

        <div className="kaki">
          Tagihan ini dibuat otomatis oleh aplikasi Balita Center dari tarif program anak. Rincian dapat diperiksa
          di Balita Connect.
        </div>
      </div>
    </main>
  );
}
