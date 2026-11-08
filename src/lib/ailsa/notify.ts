import { query } from "@/lib/db";
import { sendTemplate, whatsappConfigured } from "@/lib/whatsapp";

// Notifikasi keluar: HANYA laporan published -> wali terverifikasi anak itu.
// Tanpa isi laporan di badan pesan, hanya tautan Balita Connect.
export async function notifLaporanTerbit(reportId: string) {
  if (!whatsappConfigured()) return { terkirim: 0, alasan: "belum_dikonfigurasi" };
  const setelan = await query<{ notify_published: boolean }>("SELECT notify_published FROM bot_settings WHERE id = 1");
  if (setelan[0] && setelan[0].notify_published === false) return { terkirim: 0, alasan: "dimatikan_admin" };

  const info = await query<{ child_name: string; child_id: string; status: string }>(
    "SELECT c.full_name AS child_name, c.id AS child_id, r.status FROM daily_reports r JOIN children c ON c.id = r.child_id WHERE r.id = $1",
    [reportId]
  );
  if (!info[0] || info[0].status !== "published") return { terkirim: 0, alasan: "bukan_terbit" };

  const wali = await query<{ phone: string; full_name: string }>(
    `SELECT DISTINCT regexp_replace(coalesce(g.phone,''),'\\D','','g') AS phone, g.full_name
       FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
      WHERE cg.child_id = $1`,
    [info[0].child_id]
  );

  let terkirim = 0;
  for (const w of wali) {
    if (!w.phone || w.phone.length < 9) continue;
    // Opt-out berlaku untuk semua pesan proaktif dari nomor mana pun.
    const opt = await query<{ opt_out: boolean }>(
      "SELECT opt_out FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
      [w.phone]
    );
    if (opt[0]?.opt_out) continue;

    const hasil = await sendTemplate(w.phone, "laporan_harian_terbit", [w.full_name, info[0].child_name]);
    const lead = await query<{ id: string }>(
      "SELECT id FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
      [w.phone]
    );
    if (lead[0]) {
      await query(
        `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, wa_message_id, delivery_status, meta_error)
         VALUES ($1,'keluar','bot',$2,true,$3,$4,$5)`,
        [
          lead[0].id,
          `[template laporan_harian_terbit] ${info[0].child_name}`,
          hasil.id || null,
          hasil.ok ? "sent" : "gagal",
          hasil.ok ? null : hasil.reason || null,
        ]
      ).catch(() => null);
    }
    if (hasil.ok) terkirim += 1;
  }
  return { terkirim, alasan: null };
}
