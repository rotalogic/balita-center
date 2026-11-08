import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { whatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Job tagihan SPP bulanan + pengingat H-3 & H+1.
// Dijalankan cron (header x-job-token) atau manual oleh Super Admin dari aplikasi.
// Aman diulang: indeks unik (child_id, period_month) mencegah tagihan ganda, dan
// invoice_notifications unik per (invoice, jenis, kanal) mencegah pengingat ganda.

function periodeBerikut(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function bolehJalan(request: Request) {
  const token = request.headers.get("x-job-token");
  if (token && process.env.JOB_TOKEN && token === process.env.JOB_TOKEN) return { ok: true as const, user: null };
  const denied = await guard("finance.update");
  if (denied.error) return { ok: false as const, response: denied.error };
  return { ok: true as const, user: denied.user };
}

export async function POST(request: Request) {
  const izin = await bolehJalan(request);
  if (!izin.ok) return izin.response;

  const body = (await request.json().catch(() => ({}))) as { periode?: string; aksi?: string };
  const aksi = body.aksi || "buat";
  const periode = body.periode && /^\d{4}-\d{2}$/.test(body.periode) ? `${body.periode}-01` : `${periodeBerikut()}-01`;
  const kanalAktif = whatsappConfigured();

  try {
    if (aksi === "buat") {
      // Tarif diambil saat tagihan dibuat: perubahan tarif tidak mengubah tagihan lama.
      const dibuat = await query<{ id: string; child_id: string }>(
        `INSERT INTO invoices (branch_id, child_id, period_month, description, amount, status, due_date)
         SELECT e.branch_id, e.child_id, $1::date,
                'SPP Program ' || p.name || ' — ' || to_char($1::date, 'FMMonth YYYY'),
                p.monthly_fee, 'belum_bayar', ($1::date + INTERVAL '9 days')::date
           FROM enrollments e
           JOIN programs p ON p.id = e.program_id
           JOIN children c ON c.id = e.child_id AND c.deleted_at IS NULL AND c.status = 'aktif'
          WHERE e.status = 'aktif' AND p.monthly_fee > 0
            AND NOT EXISTS (
              SELECT 1 FROM invoices i
               WHERE i.child_id = e.child_id AND i.period_month = $1::date AND i.status <> 'batal')
         ON CONFLICT DO NOTHING
         RETURNING id, child_id`,
        [periode]
      );

      // Catat pemberitahuan: dalam aplikasi selalu, WhatsApp hanya bila kanal aktif.
      for (const inv of dibuat) {
        const wali = await query<{ user_id: string | null; phone: string | null }>(
          `SELECT g.user_id, g.phone FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
            WHERE cg.child_id = $1::uuid ORDER BY cg.is_primary DESC`,
          [inv.child_id]
        );
        for (const w of wali) {
          if (w.user_id) {
            await query(
              `INSERT INTO notifications (user_id, title, body, href)
               VALUES ($1::uuid, 'Tagihan SPP baru', $2, $3)`,
              [w.user_id, `Tagihan periode ${periode.slice(0, 7)} sudah terbit. Silakan buka menu Pembayaran.`, "/connect/pembayaran"]
            ).catch(() => null);
          }
        }
        await query(
          `INSERT INTO invoice_notifications (invoice_id, jenis, channel, status, note)
           VALUES ($1::uuid,'terbit','dalam_aplikasi','terkirim','pemberitahuan di Balita Connect')
           ON CONFLICT DO NOTHING`,
          [inv.id]
        ).catch(() => null);
        await query(
          `INSERT INTO invoice_notifications (invoice_id, jenis, channel, status, note)
           VALUES ($1::uuid,'terbit','whatsapp',$2,$3) ON CONFLICT DO NOTHING`,
          [inv.id, kanalAktif ? "terkirim" : "menunggu_kanal", kanalAktif ? "template pengingat_tagihan_spp" : "kanal WhatsApp belum aktif"]
        ).catch(() => null);
      }

      if (izin.user) {
        await catatAudit(izin.user, {
          action: "invoice.auto_create",
          entityTable: "invoices",
          detail: { periode: periode.slice(0, 7), jumlah: dibuat.length, kanal_whatsapp: kanalAktif ? "aktif" : "menunggu_kanal" },
        });
      }
      return NextResponse.json({ ok: true, periode: periode.slice(0, 7), dibuat: dibuat.length, kanal: kanalAktif ? "aktif" : "menunggu_kanal" });
    }

    if (aksi === "pengingat") {
      // H-3 dan H+1, masing-masing maksimal sekali per tagihan, berhenti bila lunas.
      const target = await query<{ id: string; jenis: string }>(
        `SELECT i.id, CASE WHEN i.due_date - CURRENT_DATE = 3 THEN 'h3'
                            WHEN CURRENT_DATE - i.due_date = 1 THEN 'h1' END AS jenis
           FROM invoices i
          WHERE i.status IN ('belum_bayar','menunggu_konfirmasi')
            AND (i.due_date - CURRENT_DATE = 3 OR CURRENT_DATE - i.due_date = 1)`
      );
      let terkirim = 0;
      for (const t of target) {
        const masuk = await query<{ id: string }>(
          `INSERT INTO invoice_notifications (invoice_id, jenis, channel, status, note)
           VALUES ($1::uuid,$2,'dalam_aplikasi','terkirim','pengingat dalam aplikasi')
           ON CONFLICT DO NOTHING RETURNING id`,
          [t.id, t.jenis]
        );
        if (masuk[0]) terkirim += 1;
        await query(
          `INSERT INTO invoice_notifications (invoice_id, jenis, channel, status, note)
           VALUES ($1::uuid,$2,'whatsapp',$3,$4) ON CONFLICT DO NOTHING`,
          [t.id, t.jenis, kanalAktif ? "terkirim" : "menunggu_kanal", kanalAktif ? "template pengingat_tagihan_spp" : "kanal WhatsApp belum aktif"]
        ).catch(() => null);
      }
      return NextResponse.json({ ok: true, aksi: "pengingat", kandidat: target.length, baru: terkirim, kanal: kanalAktif ? "aktif" : "menunggu_kanal" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal (buat | pengingat)." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
