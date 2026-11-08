import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { ADMIN_NUMBER, TEMPLATES, envStatus, provider, whatsappConfigured } from "@/lib/whatsapp";
import { llmConfigured, llmModel, llmSumber } from "@/lib/ailsa/llm";

export const dynamic = "force-dynamic";

// Status kanal apa adanya — tanpa membocorkan nilai env.
export async function GET() {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const setelan = await query<Record<string, unknown>>("SELECT * FROM bot_settings WHERE id = 1");
    const [terakhir, hitung] = await Promise.all([
      query<{ created_at: string; delivery_status: string | null }>(
        `SELECT created_at, delivery_status FROM bot_conversations
          WHERE direction = 'keluar' ORDER BY created_at DESC LIMIT 1`
      ),
      query<{ total: number; gagal: number }>(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE delivery_status = 'gagal')::int AS gagal
           FROM bot_conversations WHERE direction = 'keluar'`
      ),
    ]);
    return NextResponse.json({
      ok: true,
      configured: whatsappConfigured(),
      llm: { configured: llmConfigured(), model: llmModel(), kunci: llmSumber() },
      env: envStatus(),
      admin_number: ADMIN_NUMBER || null,
      settings: setelan[0] || null,
      templates: TEMPLATES,
      last_outbound: terakhir[0] || null,
      outbound: hitung[0],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 503 });
  }
}

// Kirim pesan uji ke satu nomor (default admin). Tidak ada kirim massal.
export async function POST(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  const body = (await request.json().catch(() => ({}))) as { to?: string; text?: string; action?: string };

  if (body.action === "simpan_setelan") {
    const s = body as unknown as Record<string, unknown>;
    await query(
      `UPDATE bot_settings SET notify_published = COALESCE($1, notify_published),
              remind_invoice = COALESCE($2, remind_invoice),
              admin_number = COALESCE($3, admin_number),
              hours_start = COALESCE($4, hours_start), hours_end = COALESCE($5, hours_end),
              updated_at = now()
        WHERE id = 1`,
      [s.notify_published ?? null, s.remind_invoice ?? null, s.admin_number ?? null, s.hours_start ?? null, s.hours_end ?? null]
    );
    await catatAudit(denied.user, { action: "ailsa.settings", entityTable: "bot_settings", detail: s });
    return NextResponse.json({ ok: true });
  }

  const to = (body.to || ADMIN_NUMBER || "").replace(/\D/g, "");
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "Nomor tujuan kosong. Isi WHATSAPP_ADMIN_NUMBER atau ketik nomor di kolom uji." },
      { status: 400 }
    );
  }
  const teks =
    body.text?.trim() ||
    "Halo, ini pesan uji dari Ailsa (Balita Center). Kalau pesan ini sampai, kanal WhatsApp sudah tersambung.";

  const hasil = await provider().sendText(to, teks);
  await query(
    `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, delivery_status, meta_error)
     VALUES (COALESCE((SELECT id FROM leads WHERE wa_number = $2 ORDER BY created_at DESC LIMIT 1),
                      (SELECT id FROM leads ORDER BY created_at LIMIT 1)),
             'keluar','admin',$1,false,$3,$4)`,
    [teks, to, hasil.ok ? "sent" : "gagal", hasil.ok ? null : hasil.reason || null]
  ).catch(() => null);

  await catatAudit(denied.user, {
    action: hasil.ok ? "ailsa.test_sent" : "ailsa.test_failed",
    entityTable: "bot_conversations",
    detail: { ke: to.slice(0, 6) + "****", alasan: hasil.reason || null },
  });

  return NextResponse.json({
    ok: hasil.ok,
    id: hasil.id || null,
    error: hasil.ok ? null : hasil.reason,
    configured: whatsappConfigured(),
    pesan: hasil.ok
      ? "Pesan uji terkirim. Status delivered/read muncul di panel setelah webhook status masuk."
      : "Pesan uji gagal — kredensial Meta belum lengkap atau nomor tidak terdaftar.",
  });
}
