import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Daftar lengkap tagihan dengan pencarian & penyaringan — melengkapi
// ringkasan "Tagihan Terbaru" di halaman Keuangan yang hanya menampilkan
// sebagian. Setiap tagihan dapat dicari menurut nama anak atau nomor
// tagihan, disaring menurut status dan periode, dan dibuka cetaknya.

const PER_HALAMAN = 25;
const STATUS = ["belum_bayar", "menunggu_konfirmasi", "lunas", "batal"];

export async function GET(request: Request) {
  const denied = await guard("finance.view");
  if (denied.error) return denied.error;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "";
  const periode = url.searchParams.get("periode") || "";
  const halaman = Math.max(1, Number(url.searchParams.get("halaman") || 1) || 1);

  const syarat: string[] = [];
  const nilai: unknown[] = [];
  if (q) {
    nilai.push(`%${q}%`);
    syarat.push(`(c.full_name ILIKE $${nilai.length} OR i.invoice_number ILIKE $${nilai.length})`);
  }
  if (STATUS.includes(status)) {
    nilai.push(status);
    syarat.push(`i.status = $${nilai.length}`);
  }
  if (/^\d{4}-\d{2}$/.test(periode)) {
    nilai.push(periode);
    syarat.push(`to_char(i.period_month, 'YYYY-MM') = $${nilai.length}`);
  }
  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";

  const totalRows = await query<{ n: string }>(
    `SELECT count(*) AS n FROM invoices i JOIN children c ON c.id = i.child_id ${where}`,
    nilai
  );
  const total = Number(totalRows[0]?.n || 0);

  const rows = await query(
    `SELECT i.id, i.invoice_number, i.status, i.description, i.amount::float8 AS amount,
            to_char(i.period_month, 'YYYY-MM') AS periode, to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
            to_char(i.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS created_on,
            c.full_name AS child_name,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif' ORDER BY e.start_date DESC LIMIT 1) AS class_name,
            (SELECT COALESCE(SUM(p.amount),0)::float8 FROM payments p
              WHERE p.invoice_id = i.id AND p.status = 'terkonfirmasi') AS paid_total,
            (SELECT r.id FROM receipts r WHERE r.invoice_id = i.id LIMIT 1) AS receipt_id,
            (SELECT r.receipt_number FROM receipts r WHERE r.invoice_id = i.id LIMIT 1) AS receipt_number
       FROM invoices i JOIN children c ON c.id = i.child_id
       ${where}
      ORDER BY i.created_at DESC
      LIMIT ${PER_HALAMAN} OFFSET ${(halaman - 1) * PER_HALAMAN}`,
    nilai
  );
  return NextResponse.json({ ok: true, rows, total, halaman, per_halaman: PER_HALAMAN });
}
