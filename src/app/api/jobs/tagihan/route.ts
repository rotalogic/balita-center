import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { whatsappConfigured } from "@/lib/whatsapp";
import { smtpConfigured, emailTagihan, emailPengingatTagihan, type InfoTagihanEmail } from "@/lib/mail";
import { pdfTagihanBuffer, rupiah } from "@/lib/pdf/tagihan";

export const dynamic = "force-dynamic";

// Job tagihan SPP bulanan + pengingat H-3 & H+1.
// Kanal pemberitahuan: dalam aplikasi selalu; email ke wali (lampiran PDF)
// bila SMTP server terisi; WhatsApp hanya bila kanal Meta aktif.
// Dijalankan cron (header x-job-token) atau manual oleh Super Admin dari aplikasi.
// Aman diulang: indeks unik (child_id, period_month) mencegah tagihan ganda, dan
// invoice_notifications unik per (invoice, jenis, kanal) mencegah pengingat ganda.

function periodeBerikut(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const fmtTgl = (iso: string | null) =>
  !iso
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
        .format(new Date(`${String(iso).slice(0, 10)}T00:00:00+07:00`));

// Kanal email: mengirim tagihan/pengingat ke email wali dengan lampiran PDF.
// Selalu tercatat di invoice_notifications (channel 'email') — terkirim,
// menunggu_kanal (SMTP belum diisi), tanpa_email, atau gagal. Kegagalan
// email tidak pernah menggagalkan job.
async function kirimEmailTagihan(invoiceId: string, jenis: "terbit" | "h3" | "h1") {
  try {
    const sudah = await query<{ status: string }>(
      "SELECT status FROM invoice_notifications WHERE invoice_id = $1::uuid AND jenis = $2 AND channel = 'email'",
      [invoiceId, jenis]
    );
    if (sudah[0]?.status === "terkirim") return;

    const wali = await query<{ full_name: string; email: string }>(
      `SELECT g.full_name, g.email FROM invoices i
         JOIN child_guardians cg ON cg.child_id = i.child_id
         JOIN guardians g ON g.id = cg.guardian_id
        WHERE i.id = $1::uuid AND g.email IS NOT NULL AND g.email <> ''
        ORDER BY cg.is_primary DESC`,
      [invoiceId]
    );

    let status: string;
    let note: string;
    if (wali.length === 0) {
      status = "tanpa_email";
      note = "tidak ada email wali tercatat";
    } else if (!smtpConfigured()) {
      status = "menunggu_kanal";
      note = "SMTP belum dikonfigurasi di server";
    } else {
      const paket = await pdfTagihanBuffer(invoiceId).catch(() => null);
      let terkirim = 0;
      let alasanGagal = "";
      for (const w of wali) {
        const info: InfoTagihanEmail = {
          wali: w.full_name,
          anak: paket?.data.child_name || "Anak",
          nomor: paket?.data.invoice_number || null,
          keterangan: paket?.data.description || "SPP Balita Center",
          jumlah: paket ? rupiah(paket.data.amount) : "-",
          jatuhTempo: fmtTgl(paket?.data.due_date || null),
          cabang: paket?.data.branch_name || "-",
          tautan: `${process.env.APP_BASE_URL || ""}/connect/pembayaran`,
        };
        const hasil = jenis === "terbit"
          ? await emailTagihan(w.email, info, paket?.buffer)
          : await emailPengingatTagihan(w.email, info, jenis, paket?.buffer);
        if (hasil.ok) terkirim += 1;
        else if (!alasanGagal) alasanGagal = hasil.alasan || "gagal";
      }
      status = terkirim > 0 ? "terkirim" : "gagal";
      note = terkirim > 0
        ? `terkirim ke ${terkirim} email wali${paket ? " + lampiran PDF" : " (PDF gagal dibuat, tanpa lampiran)"}`
        : `gagal kirim: ${alasanGagal}`;
    }
    await query(
      `INSERT INTO invoice_notifications (invoice_id, jenis, channel, status, note)
       VALUES ($1::uuid, $2, 'email', $3, $4)
       ON CONFLICT (invoice_id, jenis, channel) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note`,
      [invoiceId, jenis, status, note]
    );
  } catch {
    /* email tidak boleh menggagalkan job tagihan */
  }
}

async function bolehJalan(request: Request) {
  const token = request.headers.get("x-job-token");
  if (token && process.env.JOB_TOKEN && token === process.env.JOB_TOKEN) return { ok: true as const, user: null };
  const denied = await guard("finance.manage");
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
        await kirimEmailTagihan(inv.id, "terbit");
      }

      if (izin.user) {
        await catatAudit(izin.user, {
          action: "invoice.auto_create",
          entityTable: "invoices",
          detail: { periode: periode.slice(0, 7), jumlah: dibuat.length, kanal_whatsapp: kanalAktif ? "aktif" : "menunggu_kanal" },
        });
      }
      return NextResponse.json({ ok: true, periode: periode.slice(0, 7), dibuat: dibuat.length, kanal: kanalAktif ? "aktif" : "menunggu_kanal", email: smtpConfigured() ? "aktif" : "menunggu_smtp" });
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
        await kirimEmailTagihan(t.id, t.jenis as "h3" | "h1");
      }
      return NextResponse.json({ ok: true, aksi: "pengingat", kandidat: target.length, baru: terkirim, kanal: kanalAktif ? "aktif" : "menunggu_kanal", email: smtpConfigured() ? "aktif" : "menunggu_smtp" });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal (buat | pengingat)." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
