import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Ambil alih / kembalikan percakapan ke bot. Semua pesan admin tercatat
// sebagai arah keluar-manual (sender = 'admin').
export async function POST(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as { wa_number?: string; action?: "ambil" | "kembalikan"; text?: string };
    const wa = (body.wa_number || "").replace(/\D/g, "");
    if (!wa) return NextResponse.json({ ok: false, error: "Nomor WhatsApp wajib diisi." }, { status: 400 });

    const lead = await query<{ id: string }>(
      "SELECT id FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
      [wa]
    );
    if (!lead[0]) return NextResponse.json({ ok: false, error: "Percakapan tidak ditemukan." }, { status: 404 });

    if (body.action === "ambil") {
      await query("UPDATE leads SET takeover_at = now(), bot_status = 'diteruskan_ke_admin' WHERE id = $1", [lead[0].id]);
      if (body.text?.trim()) {
        await query(
          `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot)
           VALUES ($1,'keluar','admin',$2,false)`,
          [lead[0].id, body.text.trim()]
        );
      }
      await catatAudit(denied.user, { action: "ailsa.takeover", entityTable: "leads", entityId: lead[0].id });
      return NextResponse.json({ ok: true, takeover: true });
    }

    await query("UPDATE leads SET takeover_at = NULL, bot_status = 'baru' WHERE id = $1", [lead[0].id]);
    await catatAudit(denied.user, { action: "ailsa.handback", entityTable: "leads", entityId: lead[0].id });
    return NextResponse.json({ ok: true, takeover: false });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
