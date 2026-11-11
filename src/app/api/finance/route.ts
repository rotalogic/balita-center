import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { PESAN_SKEMA_RANCANGAN, programRancanganDiCabang, skemaRancanganAnak } from "@/lib/skema-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard("finance.view");
  if (denied.error) return denied.error;
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
  const denied = await guard("finance.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, string>;
    if (body.action === "spp_massal") {
      if (!body.branch_id) return NextResponse.json({ ok: false, error: "Cabang wajib dipilih." }, { status: 400 });
      const programRancangan = await programRancanganDiCabang(body.branch_id);
      if (programRancangan.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Tagihan massal ditolak: program ${programRancangan.join(", ")} memakai skema biaya berstatus Rancangan. Skema Rancangan terkunci dari pembuatan invoice sampai founder menjadikannya Final.` },
          { status: 400 }
        );
      }
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
      await catatAudit(denied.user, {
        action: "invoice.bulk",
        entityTable: "invoices",
        branchId: body.branch_id,
        detail: { periode: period, dibuat: created.length },
      });
      return NextResponse.json({ ok: true, created: created.length, names: created.map((c) => c.child_name) });
    }
    // Buat tagihan satu anak untuk periode tertentu (Blok 5B).
    if (body.action === "tagihan_anak") {
      if (!body.child_id || !body.period_month) {
        return NextResponse.json({ ok: false, error: "Anak dan periode wajib dipilih." }, { status: 400 });
      }
      if (!/^\d{4}-\d{2}$/.test(body.period_month)) {
        return NextResponse.json({ ok: false, error: "Periode harus format bulan-tahun, contoh 2026-12." }, { status: 400 });
      }
      const periode = `${body.period_month}-01`;

      const anak = await query<{ id: string; full_name: string; branch_id: string }>(
        "SELECT id, full_name, branch_id FROM children WHERE id = $1 AND deleted_at IS NULL",
        [body.child_id]
      );
      if (anak.length === 0) {
        return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
      }

      const ada = await query<{ id: string; amount: string }>(
        "SELECT id, amount FROM invoices WHERE child_id = $1 AND period_month = $2::date AND status <> 'batal'",
        [body.child_id, periode]
      );
      if (ada.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `Sudah ada tagihan untuk ${anak[0].full_name} pada periode itu.`,
            existing_id: ada[0].id,
          },
          { status: 409 }
        );
      }

      const skemaRancangan = await skemaRancanganAnak(body.child_id);
      if (skemaRancangan) {
        return NextResponse.json({ ok: false, error: PESAN_SKEMA_RANCANGAN(skemaRancangan) }, { status: 400 });
      }
      const tarif = await query<{ monthly_fee: string | null; program_name: string }>(
        `SELECT p.monthly_fee, p.name AS program_name
           FROM enrollments e JOIN programs p ON p.id = e.program_id
          WHERE e.child_id = $1 AND e.status = 'aktif'
          ORDER BY e.start_date DESC LIMIT 1`,
        [body.child_id]
      );
      const tarifDefault = Number(tarif[0]?.monthly_fee || 0);
      const nominal = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : tarifDefault;
      if (!Number.isFinite(nominal) || nominal <= 0) {
        return NextResponse.json(
          { ok: false, error: "Nominal tidak valid. Program anak ini belum punya tarif SPP — isi nominal manual." },
          { status: 400 }
        );
      }
      const alasan = (body.reason || "").trim();
      if (body.amount !== undefined && body.amount !== "" && tarifDefault > 0 && Number(body.amount) !== tarifDefault && alasan.length < 3) {
        return NextResponse.json(
          { ok: false, error: `Nominal berbeda dari tarif program (Rp${tarifDefault.toLocaleString("id-ID")}). Tulis alasan perubahan (minimal 3 karakter).` },
          { status: 400 }
        );
      }

      const dibuat = await query<{ id: string }>(
        `INSERT INTO invoices (branch_id, child_id, period_month, description, amount, status, due_date)
         VALUES ($1,$2,$3::date,$4,$5,'belum_bayar',($3::date + INTERVAL '9 days')::date) RETURNING id`,
        [
          anak[0].branch_id,
          body.child_id,
          periode,
          `SPP${tarif[0]?.program_name ? ` Program ${tarif[0].program_name}` : ""} — ${new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${periode}T00:00:00Z`))}`,
          nominal,
        ]
      );
      await catatAudit(denied.user, {
        action: "invoice.create",
        entityTable: "invoices",
        entityId: dibuat[0].id,
        branchId: anak[0].branch_id,
        detail: {
          anak: anak[0].full_name,
          periode: body.period_month,
          nominal,
          tarif_program: tarifDefault,
          alasan: alasan || null,
          ubah_nominal: Number(body.amount) !== tarifDefault,
        },
      });
      return NextResponse.json({ ok: true, id: dibuat[0].id, amount: nominal, tariff: tarifDefault });
    }

    if (body.action === "konfirmasi_bayar") {
      if (!body.invoice_id || !body.confirmed_by) return NextResponse.json({ ok: false, error: "Tagihan dan staf pengonfirmasi wajib diisi." }, { status: 400 });
      const inv = await query<{ branch_id: string; amount: string; child_id: string }>(
        "SELECT branch_id, amount, child_id FROM invoices WHERE id = $1",
        [body.invoice_id]
      );
      if (inv.length === 0) return NextResponse.json({ ok: false, error: "Tagihan tidak ditemukan." }, { status: 404 });
      const skemaBayar = await skemaRancanganAnak(inv[0].child_id);
      if (skemaBayar) {
        return NextResponse.json(
          { ok: false, error: `Pembayaran ditolak: ${PESAN_SKEMA_RANCANGAN(skemaBayar)}` },
          { status: 400 }
        );
      }
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
        // Kwitansi resmi terbit sekali per tagihan (nomor urut dari database).
        // Idempotent: hanya kwitansi yang BARU dibuat memicu audit.
        const kwBaru = await query<{ id: string }>(
          `INSERT INTO receipts (invoice_id, branch_id, amount, method, received_by, paid_at)
           SELECT $1::uuid, $2::uuid, $3::numeric, $4, $5::uuid, CURRENT_DATE
            WHERE NOT EXISTS (SELECT 1 FROM receipts WHERE invoice_id = $1::uuid)
           RETURNING id`,
          [body.invoice_id, inv[0].branch_id, Number(paid[0].total), body.method || "transfer", body.confirmed_by]
        ).catch(() => []);
        const kw = await query<{ id: string; receipt_number: string }>(
          "SELECT id, receipt_number FROM receipts WHERE invoice_id = $1::uuid",
          [body.invoice_id]
        );
        if (kwBaru.length > 0) await catatAudit(denied.user, {
          action: "receipt.issue",
          entityTable: "receipts",
          entityId: kw[0]?.id || null,
          branchId: inv[0].branch_id,
          detail: { nomor: kw[0]?.receipt_number || null, tagihan: body.invoice_id, nominal: Number(paid[0].total) },
        });
      } else {
        await query("UPDATE invoices SET status = 'menunggu_konfirmasi' WHERE id = $1 AND status = 'belum_bayar'", [body.invoice_id]);
      }
      return NextResponse.json({ ok: true, paidTotal: Number(paid[0].total) });
    }
    if (body.action === "batal_bayar") {
      if (!body.invoice_id) return NextResponse.json({ ok: false, error: "Tagihan wajib diisi." }, { status: 400 });
      await query("UPDATE payments SET status = 'dibatalkan' WHERE invoice_id = $1::uuid", [body.invoice_id]);
      await query(
        "UPDATE receipts SET cancelled_at = now(), cancelled_reason = $2 WHERE invoice_id = $1::uuid AND cancelled_at IS NULL",
        [body.invoice_id, (body.reason || "Pembayaran dibatalkan admin").slice(0, 200)]
      );
      await query("UPDATE invoices SET status = 'belum_bayar' WHERE id = $1::uuid", [body.invoice_id]);
      const dibatalkan = await query<{ id: string }>(
        "UPDATE receipts SET cancelled_at = now(), cancelled_reason = $2 WHERE invoice_id = $1::uuid AND cancelled_at IS NULL RETURNING id",
        [body.invoice_id, (body.reason || "Pembayaran dibatalkan admin").slice(0, 200)]
      );
      if (dibatalkan.length > 0) await catatAudit(denied.user, {
        action: "receipt.cancel",
        entityTable: "receipts",
        entityId: dibatalkan[0].id,
        detail: { alasan: (body.reason || "").trim() || null, tagihan: body.invoice_id },
      });
      return NextResponse.json({ ok: true, cancelled: true });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
