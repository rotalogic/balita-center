import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [invoices, entries, totals] = await Promise.all([
      query(
        `SELECT i.*, c.full_name AS child_name,
                (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'terkonfirmasi') AS paid_total
           FROM invoices i LEFT JOIN children c ON c.id = i.child_id
          ORDER BY i.created_at DESC LIMIT 100`
      ),
      query("SELECT * FROM cash_book_entries ORDER BY entry_date DESC, created_at DESC LIMIT 20"),
      query<{ masuk: string; keluar: string }>(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE direction='masuk'),0) AS masuk,
                COALESCE(SUM(amount) FILTER (WHERE direction='keluar'),0) AS keluar
           FROM cash_book_entries
          WHERE date_trunc('month', entry_date) = date_trunc('month', CURRENT_DATE)`
      ),
    ]);
    return NextResponse.json({ ok: true, invoices, entries, monthIn: Number(totals[0].masuk), monthOut: Number(totals[0].keluar) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    if (body.action === "spp_massal") {
      if (!body.branch_id) return NextResponse.json({ ok: false, error: "Cabang wajib dipilih." }, { status: 400 });
      const period = body.period_month || new Date().toISOString().slice(0, 7) + "-01";
      const created = await query<{ child_name: string }>(
        `INSERT INTO invoices (branch_id, child_id, period_month, description, amount, status, due_date)
         SELECT e.branch_id, e.child_id, $2::date,
                'SPP ' || to_char($2::date, 'FMMonth YYYY'),
                p.monthly_fee, 'belum_bayar',
                ($2::date + INTERVAL '9 days')::date
           FROM enrollments e
           JOIN programs p ON p.id = e.program_id
          WHERE e.branch_id = $1 AND e.status = 'aktif' AND p.monthly_fee IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.child_id = e.child_id AND i.period_month = $2::date AND i.status <> 'batal')
         RETURNING (SELECT full_name FROM children WHERE id = child_id) AS child_name`,
        [body.branch_id, period]
      );
      return NextResponse.json({ ok: true, created: created.length, names: created.map((c) => c.child_name) });
    }
    if (body.action === "konfirmasi_bayar") {
      if (!body.invoice_id || !body.confirmed_by) return NextResponse.json({ ok: false, error: "Tagihan dan staf pengonfirmasi wajib diisi." }, { status: 400 });
      const inv = await query<{ branch_id: string; amount: string; child_id: string }>(
        "SELECT branch_id, amount, child_id FROM invoices WHERE id = $1",
        [body.invoice_id]
      );
      if (inv.length === 0) return NextResponse.json({ ok: false, error: "Tagihan tidak ditemukan." }, { status: 404 });
      const amount = Number(body.amount || inv[0].amount);
      const cash = await query<{ id: string }>(
        `INSERT INTO cash_book_entries (branch_id, entry_date, direction, category, description, amount, source_type, source_id, created_by)
         VALUES ($1, CURRENT_DATE, 'masuk', 'SPP', 'Pembayaran SPP terkonfirmasi', $2, 'tagihan', $3, $4) RETURNING id`,
        [inv[0].branch_id, amount, body.invoice_id, body.confirmed_by]
      );
      await query(
        `INSERT INTO payments (branch_id, invoice_id, method, amount, status, paid_at, confirmed_by, cash_entry_id)
         VALUES ($1,$2,$3,$4,'terkonfirmasi',CURRENT_TIMESTAMP,$5,$6)`,
        [inv[0].branch_id, body.invoice_id, body.method || "transfer", amount, body.confirmed_by, cash[0].id]
      );
      const paid = await query<{ total: string }>(
        "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE invoice_id = $1 AND status = 'terkonfirmasi'",
        [body.invoice_id]
      );
      if (Number(paid[0].total) >= Number(inv[0].amount)) {
        await query("UPDATE invoices SET status = 'lunas' WHERE id = $1", [body.invoice_id]);
      } else {
        await query("UPDATE invoices SET status = 'menunggu_konfirmasi' WHERE id = $1 AND status = 'belum_bayar'", [body.invoice_id]);
      }
      return NextResponse.json({ ok: true, paidTotal: Number(paid[0].total) });
    }
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
