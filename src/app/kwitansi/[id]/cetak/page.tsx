import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { tanggalPanjang } from "@/lib/format";
import { terbilang } from "@/lib/terbilang";
import { TombolCetak } from "@/components/tombol-cetak";
import { GayaDokumen } from "@/components/dokumen";

export const dynamic = "force-dynamic";

const rupiah = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

const METODE: Record<string, string> = {
  transfer: "Transfer bank", tunai: "Tunai", qris: "QRIS", lainnya: "Lainnya",
};

// Kwitansi PDF: terbit otomatis saat tagihan Lunas. Bisa berwatermark DIBATALKAN.
export default async function CetakKwitansi({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/kwitansi/${params.id}/cetak`)}`);

  const rows = await query<{
    invoice_id: string; invoice_number: string | null; receipt_number: string | null;
    amount: string; paid_at: string; method: string | null; cancelled_at: string | null;
    child_id: string | null; child_name: string | null; class_name: string | null;
    guardian_name: string | null; branch_name: string; description: string | null;
    period_month: string; petugas: string | null;
  }>(
    `SELECT i.id AS invoice_id, i.invoice_number, r.receipt_number, r.amount, r.paid_at, r.method,
            to_char(r.cancelled_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD"T"HH24:MI') AS cancelled_at,
            c.id AS child_id, c.full_name AS child_name,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif' ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name,
            (SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
              WHERE cg.child_id = c.id ORDER BY cg.is_primary DESC LIMIT 1) AS guardian_name,
            b.name AS branch_name, i.description, i.period_month, s.full_name AS petugas
       FROM receipts r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN branches b ON b.id = r.branch_id
       LEFT JOIN children c ON c.id = i.child_id
       LEFT JOIN staff s ON s.id = r.received_by
      WHERE r.invoice_id = $1::uuid`,
    [params.id]
  );
  const k = rows[0];
  if (!k) notFound();

  // Staf berhak, atau wali anak itu sendiri.
  let boleh = hasPermission(user, "finance.view");
  if (!boleh && k.child_id) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [k.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh kwitansi ini.", { status: 403 });

  const batal = Boolean(k.cancelled_at);

  return (
    <main className="dokumen-wrap">
      <GayaDokumen />
      <div className="aksi">
        <a href="/keuangan">Kembali</a>
        <TombolCetak />
      </div>

      <div className="lembar cap">
        <div className="baris">
          <div>
            <div className="merek">BALITA CENTER</div>
            <div className="cabang">Montessori &amp; Childcare — Cabang {k.branch_name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="judul">KWITANSI PEMBAYARAN</div>
            <div className="sub">Bukti pembayaran resmi</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          Nomor Kwitansi: <strong>{k.receipt_number || "—"}</strong>{" "}
          <span className="pil" style={batal ? { background: "#fdeceb", color: "#b42318", borderColor: "#f6c7c2" } : undefined}>
            {batal ? "DIBATALKAN" : "LUNAS"}
          </span>
        </div>

        <div className="kotak" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          <div><span>Diterima dari</span><strong>{k.guardian_name || "—"}</strong>
            {k.child_name ? <div className="sub">Wali dari {k.child_name}</div> : null}</div>
          <div><span>Anak / Kelas</span><strong>{k.child_name || "—"}</strong><div className="sub">{k.class_name || "—"}</div></div>
          <div><span>Tanggal</span><strong>{tanggalPanjang(k.paid_at)}</strong>
            <div className="sub">{METODE[k.method || "transfer"] || k.method}</div></div>
        </div>

        <p className="catatan" style={{ marginTop: 16 }}>
          Untuk pembayaran: <strong>{k.description || `SPP — ${tanggalPanjang(k.period_month)}`}</strong>
        </p>

        <div className="total">
          <span>Jumlah</span>
          <span>{rupiah(Number(k.amount))}</span>
        </div>
        <p className="catatan"><strong>Terbilang:</strong> {terbilang(Number(k.amount))}</p>

        <div className="tanda">
          <div>
            <div className="sub">Petugas penerima,</div>
            <div className="nama">{k.petugas || "Admin Balita Center"}</div>
          </div>
          <div>
            <div className="sub">Wali,</div>
            <div className="nama">{k.guardian_name || "________________"}</div>
          </div>
        </div>

        {batal ? (
          <div className="cap-dibatalkan"><span>DIBATALKAN</span></div>
        ) : null}

        <div className="kaki">
          Kwitansi dibuat otomatis begitu pembayaran tercatat Lunas.{" "}
          {batal ? `Dibatalkan pada ${k.cancelled_at ? `${tanggalPanjang(k.cancelled_at.slice(0, 10))}` : "-"} — dokumen tidak dihapus, hanya ditandai.` : ""}
          {" "}Tersedia juga untuk wali di Balita Connect.
        </div>
      </div>
    </main>
  );
}
