import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { giliranAilsa } from "@/lib/ailsa/brain";
import { llmConfigured, llmModel, llmSumber } from "@/lib/ailsa/llm";

export const dynamic = "force-dynamic";

// Obrolan uji di dalam aplikasi: memakai otak yang SAMA dengan WhatsApp,
// tapi tanpa kanal Meta. Dipakai staf untuk memverifikasi jawaban & pengawalan.
export async function POST(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;

  if (!llmConfigured()) {
    return NextResponse.json({ ok: false, error: "Otak LLM belum dikonfigurasi (AILSA_LLM_API_KEY kosong)." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as {
      text?: string;
      persona?: "calon" | "wali" | "wali_belum" | "staf";
      child_id?: string;
    };
    const teks = (body.text || "").trim();
    if (teks.length < 2) return NextResponse.json({ ok: false, error: "Pesan terlalu pendek." }, { status: 400 });

    const staf = await query<{ id: string; full_name: string }>(
      "SELECT id, full_name FROM staff WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2)) LIMIT 1",
      [denied.user.id, denied.user.email]
    );

    // Nomor semu per pengguna supaya riwayat obrolan web terpisah dari WhatsApp.
    // Sesi simulator: nomor semu per pengguna, ditandai agar log terpisah dari WhatsApp.
    const wa = `simulator-${denied.user.id}`;
    const persona = body.persona || "calon";
    const hasil = await giliranAilsa(
      wa,
      teks,
      staf[0] ? { staffId: staf[0].id, nama: staf[0].full_name } : undefined,
      persona,
      body.child_id
    );

    // Catat percakapan simulator sebagai bukti uji (channel terpisah).
    const leadSim = await query<{ id: string }>(
      `INSERT INTO leads (wa_number, source, bot_status, stage)
       SELECT $1::varchar, 'simulator', 'baru', 'lead_masuk'
        WHERE NOT EXISTS (SELECT 1 FROM leads WHERE wa_number = $1::varchar)`,
      [wa]
    ).then(() =>
      query<{ id: string }>("SELECT id FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1", [wa])
    );
    if (leadSim[0]) {
      await query(
        `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, channel)
         VALUES ($1,'masuk','calon_ortu',$2,false,'simulator'),
                ($1,'keluar','bot',$3,true,'simulator')`,
        [leadSim[0].id, `[${persona}] ${teks}`, hasil.balasan]
      ).catch(() => null);
    }

    // Panel Proses menampilkan JUDUL pertanyaan butir yang benar-benar dipakai.
    const judulPengetahuan = hasil.pengetahuan_ids.length
      ? (await query<{ question_sample: string }>(
          "SELECT question_sample FROM bot_knowledge_entries WHERE id = ANY($1::uuid[])",
          [hasil.pengetahuan_ids]
        )).map((x) => x.question_sample)
      : [];

    return NextResponse.json({
      ok: true,
      persona,
      tool: hasil.tool,
      model: llmModel(),
      sesi_staf: Boolean(staf[0]),
      sumber_llm: hasil.sumber,
      kunci: llmSumber(),
      reply: hasil.balasan,
      dikirim: hasil.dikirim,
      eskalasi: hasil.eskalasi,
      ditahan: hasil.alasanBlokir || null,
      sumber: hasil.sumber,
      intent: hasil.keluaran.intent,
      confidence: hasil.keluaran.confidence,
      pengetahuan_dipakai: judulPengetahuan,
      perlu_admin: hasil.keluaran.need_admin,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message || "Gagal memproses." }, { status: 500 });
  }
}
