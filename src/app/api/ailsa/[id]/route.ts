import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STATUS = ["draft", "aktif", "nonaktif"];

// Setujui / nonaktifkan entri bank pengetahuan, atau tutup eskalasi percakapan.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { status?: string; answer_text?: string; close_escalation?: boolean };

    if (body.close_escalation) {
      await query(
        `UPDATE bot_conversations SET escalated = false
          WHERE lead_id = (SELECT lead_id FROM bot_conversations WHERE id = $1)`,
        [params.id]
      );
      await catatAudit(denied.user, {
        action: "ailsa.escalation_close",
        entityTable: "bot_conversations",
        entityId: params.id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.status !== undefined && !STATUS.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `Status harus salah satu: ${STATUS.join(", ")}.` },
        { status: 400 }
      );
    }

    const values: unknown[] = [params.id];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.status !== undefined) {
      add("status", body.status);
      if (body.status === "aktif") {
        // approved_by bertipe staff(id) pada skema ini; cocokkan lewat email,
        // kalau tidak ada biarkan NULL (jejak waktu tetap tercatat).
        const staf = await query<{ id: string }>(
          "SELECT id FROM staff WHERE lower(email) = lower($1) LIMIT 1",
          [denied.user.email]
        );
        add("approved_by", staf[0]?.id || null);
        add("approved_at", new Date());
      }
    }
    if (body.answer_text !== undefined) add("answer_text", body.answer_text);

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada perubahan." }, { status: 400 });
    }

    await query(
      `UPDATE bot_knowledge_entries SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
      values
    );
    await catatAudit(denied.user, {
      action: "ailsa.knowledge_update",
      entityTable: "bot_conversations",
      entityId: params.id,
      detail: body,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
