import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { whatsappConfigured } from "@/lib/whatsapp";
import { llmConfigured, segarkanKonfigurasi } from "@/lib/ailsa/llm";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Data halaman Ailsa: status kanal, percakapan terbaru, bank pengetahuan,
// dan pertanyaan yang belum terjawab.
export async function GET() {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    await segarkanKonfigurasi();
    const [percakapan, pengetahuan, takTerjawab, leads] = await Promise.all([
      query(
        `SELECT c.id, c.direction, c.sender, c.message_text, c.escalated, c.created_at,
                c.delivery_status, c.blocked_reason, c.unanswered_question,
                l.wa_number, l.parent_name, l.child_name, l.takeover_at
           FROM bot_conversations c
           LEFT JOIN leads l ON l.id = c.lead_id
          ORDER BY c.created_at DESC LIMIT 60`
      ),
      query(
        `SELECT k.*, b.name AS branch_name
           FROM bot_knowledge_entries k LEFT JOIN branches b ON b.id = k.branch_id
          ORDER BY k.status, k.updated_at DESC LIMIT 200`
      ),
      query(
        `SELECT COALESCE(unanswered_question, message_text) AS message_text, COUNT(*)::int AS total
           FROM bot_conversations
          WHERE direction = 'masuk'
            AND (unanswered_question IS NOT NULL OR blocked_reason IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM bot_conversations balas
               WHERE balas.lead_id = bot_conversations.lead_id
                 AND balas.direction = 'keluar'
                 AND balas.created_at > bot_conversations.created_at
                 AND COALESCE(balas.blocked_reason,'') = '')
          GROUP BY 1 ORDER BY total DESC LIMIT 50`
      ),
      query(
        `SELECT id, wa_number, parent_name, child_name, child_age_months, stage, bot_status, created_at,
                opt_out, takeover_at
           FROM leads WHERE source = 'whatsapp_ailsa' ORDER BY created_at DESC LIMIT 50`
      ),
    ]);

    return NextResponse.json({
      ok: true,
      configured: whatsappConfigured(),
      llmConfigured: llmConfigured(),
      conversations: percakapan,
      knowledge: pengetahuan,
      unanswered: takTerjawab,
      leads,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Tambah entri bank pengetahuan. Selalu masuk status draft sampai disetujui.
export async function POST(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      question_sample?: string;
      answer_text?: string;
      branch_id?: string;
    };
    const pertanyaan = (body.question_sample || "").trim();
    const jawaban = (body.answer_text || "").trim();

    if (pertanyaan.length < 5 || jawaban.length < 5) {
      return NextResponse.json(
        { ok: false, error: "Pertanyaan dan jawaban minimal 5 karakter." },
        { status: 400 }
      );
    }

    // Satu pertanyaan kanonis = satu butir. Duplikat ditolak dengan tawaran gabung.
    const mirip = await query<{ id: string; question_sample: string; status: string }>(
      `SELECT id, question_sample, status FROM bot_knowledge_entries
        WHERE lower(btrim(question_sample)) = lower(btrim($1)) AND status <> 'nonaktif'
        LIMIT 1`,
      [pertanyaan]
    );
    if (mirip[0]) {
      return NextResponse.json(
        {
          ok: false,
          error: `Pertanyaan ini sudah ada (status ${mirip[0].status}). Gabungkan jawaban ke butir itu atau arsipkan salah satunya.`,
          existing_id: mirip[0].id,
        },
        { status: 409 }
      );
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO bot_knowledge_entries (question_sample, answer_text, branch_id, status)
       VALUES ($1,$2,$3,'draft') RETURNING id`,
      [pertanyaan, jawaban, body.branch_id || null]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

// Setujui / nonaktifkan butir bank pengetahuan. Draft tidak pernah dipakai bot.
export async function PATCH(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { id?: string; status?: string; answer_text?: string; alasan?: string };
    if (!body.id) return NextResponse.json({ ok: false, error: "ID butir wajib diisi." }, { status: 400 });
    // Draf -> Aktif (setujui) / Nonaktif (tolak atau arsip). Tidak ada status lain.
    const status =
      body.status === "aktif" || body.status === "disetujui" ? "aktif"
      : body.status === "nonaktif" || body.status === "arsip" || body.status === "ditolak" ? "nonaktif"
      : null;
    if (!status) return NextResponse.json({ ok: false, error: "Status harus aktif atau arsip." }, { status: 400 });

    // approved_by menunjuk staff(id), bukan users(id).
    const staf = await query<{ id: string }>(
      "SELECT id FROM staff WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2)) LIMIT 1",
      [denied.user.id, denied.user.email]
    );
    const rows = await query<{ id: string }>(
      `UPDATE bot_knowledge_entries
          SET status = $1::varchar,
              answer_text = COALESCE(NULLIF($2::text,''), answer_text),
              approved_by = CASE WHEN $1::varchar = 'aktif' THEN $3::uuid ELSE approved_by END,
              approved_at = CASE WHEN $1::varchar = 'aktif' THEN now() ELSE approved_at END,
              updated_at = now()
        WHERE id = $4::uuid RETURNING id`,
      [status, (body.answer_text || "").trim(), staf[0]?.id || null, body.id]
    );
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Butir tidak ditemukan." }, { status: 404 });
    await catatAudit(denied.user, {
      action: status === "aktif" ? "ailsa.knowledge_setujui" : "ailsa.knowledge_arsipkan",
      entityTable: "bot_knowledge_entries",
      entityId: body.id,
      detail: { status, alasan: (body.alasan || "").trim() || null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
