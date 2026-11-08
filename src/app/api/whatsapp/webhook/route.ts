import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { giliranAilsa, simpanLeadDariKeluaran } from "@/lib/ailsa/brain";
import { provider, verifyToken } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// GET: verifikasi langganan webhook Meta.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge") || "";
  const diharapkan = verifyToken();

  if (!diharapkan) {
    return NextResponse.json({ ok: false, error: "WHATSAPP_VERIFY_TOKEN belum diisi." }, { status: 503 });
  }
  if (mode === "subscribe" && token === diharapkan) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ ok: false, error: "Token verifikasi tidak cocok." }, { status: 403 });
}

// POST: pesan & status dari Meta. Tanda tangan wajib valid.
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET || "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "WHATSAPP_APP_SECRET belum diisi." }, { status: 503 });
  }

  const mentah = await request.text();
  const tanda = request.headers.get("x-hub-signature-256") || "";
  const harap = "sha256=" + createHmac("sha256", secret).update(mentah).digest("hex");
  const a = Buffer.from(tanda);
  const b = Buffer.from(harap);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "Tanda tangan tidak valid." }, { status: 401 });
  }

  const body = JSON.parse(mentah || "{}") as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{ id: string; from: string; type: string; text?: { body?: string }; button?: { text?: string } }>;
          statuses?: Array<{ id: string; status: string; errors?: Array<{ title?: string }> }>;
        };
      }>;
    }>;
  };

  // Balas 200 cepat; pemrosesan tetap dijalankan di proses yang sama.
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      for (const s of v.statuses || []) {
        await query(
          `UPDATE bot_conversations SET delivery_status = $1,
                  meta_error = COALESCE($2, meta_error)
            WHERE wa_message_id = $3`,
          [s.status, s.errors?.[0]?.title || null, s.id]
        ).catch(() => null);
      }
      for (const m of v.messages || []) {
        void prosesPesan(m).catch((e) => console.error("[AILSA:PROSES]", (e as Error)?.message));
      }
    }
  }
  return NextResponse.json({ ok: true });
}

async function prosesPesan(m: { id: string; from: string; type: string; text?: { body?: string }; button?: { text?: string } }) {
  const teks = m.text?.body || m.button?.text || "";
  if (!teks.trim()) return;
  const wa = m.from;

  // Nomor baru selalu punya baris lead supaya percakapan bisa dicatat
  // (bot_conversations.lead_id wajib dan ber-FK).
  const lead = await query<{ id: string; opt_out: boolean; takeover_at: string | null }>(
    `INSERT INTO leads (wa_number, source, bot_status, stage)
     SELECT $1::varchar, 'whatsapp_ailsa', 'baru', 'lead_masuk'
      WHERE NOT EXISTS (SELECT 1 FROM leads WHERE wa_number = $1::varchar)`,
    [wa]
  ).then(() =>
    query<{ id: string; opt_out: boolean; takeover_at: string | null }>(
      "SELECT id, opt_out, takeover_at FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
      [wa]
    )
  );
  const l = lead[0];

  // Deduplikasi wamid: webhook ulang tidak menghasilkan balasan/lead ganda.
  const masuk = await query<{ id: string }>(
    `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, wa_message_id)
     VALUES ($1,'masuk','calon_ortu',$2,false,$3)
     ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING RETURNING id`,
    [l.id, teks, m.id]
  );
  if (masuk.length === 0) return; // sudah pernah diproses

  // Admin sudah mengambil alih: bot diam, pesan tetap tercatat.
  if (l?.takeover_at) {
    await query("UPDATE bot_conversations SET blocked_reason='takeover' WHERE id=$1", [masuk[0].id]);
    return;
  }

  const lower = teks.trim().toLowerCase();
  if (["stop", "berhenti", "jangan hubungi lagi", "unsubscribe"].includes(lower)) {
    await query(
      `UPDATE leads SET opt_out = true, opt_out_at = now(), bot_status = 'tidak_lanjut', updated_at = now()
        WHERE wa_number = $1`,
      [wa]
    );
    await balas(wa, "Baik, pesan proaktif dari Balita Center ke nomor ini saya hentikan. Terima kasih.", null, false);
    return;
  }
  if (l?.opt_out) return;

  const hasil = await giliranAilsa(wa, teks);
  const leadBaru = await simpanLeadDariKeluaran(wa, hasil.keluaran, l?.id ?? null);

  if (hasil.keluaran.unanswered_question) {
    await query("UPDATE bot_conversations SET unanswered_question = $1 WHERE id = $2", [
      hasil.keluaran.unanswered_question,
      masuk[0].id,
    ]);
  }
  if (hasil.alasanBlokir) {
    await query("UPDATE bot_conversations SET blocked_reason = $1 WHERE id = $2", [
      hasil.alasanBlokir.slice(0, 60),
      masuk[0].id,
    ]);
  }
  if (hasil.keluaran.need_admin || hasil.eskalasi) {
    await query("UPDATE bot_conversations SET escalated = true WHERE id = $1", [masuk[0].id]);
  }

  await balas(wa, hasil.balasan, leadBaru.id || l?.id || null, hasil.dikirim);
}

async function balas(wa: string, teks: string, leadId: string | null, _dikirim: boolean) {
  const hasil = await provider().sendText(wa, teks);
  // lead_id wajib (NOT NULL + FK): ambil baris lead nomor ini bila pemanggil belum punya.
  const id =
    leadId ||
    (
      await query<{ id: string }>(
        "SELECT id FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
        [wa]
      )
    )[0]?.id;
  if (!id) return;
  await query(
    `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, wa_message_id, delivery_status, meta_error)
     VALUES ($1,'keluar','bot',$2,true,$3,$4,$5)`,
    [id, teks, hasil.id || null, hasil.ok ? "sent" : "gagal", hasil.ok ? null : hasil.reason || null]
  );
}
