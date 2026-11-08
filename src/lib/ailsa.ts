import { query } from "@/lib/db";
import { sendText } from "@/lib/whatsapp";

// Otak Ailsa: aturan keras — hanya menjawab dari bank pengetahuan yang sudah
// disetujui atau dari data sekolah terstruktur. Tidak pernah mengarang.

const MENU = `Halo! Saya Ailsa, asisten Balita Center 🌼

Silakan pilih:
1. Info & biaya
2. Jadwal trial
3. Lokasi & jam
4. Bicara dengan admin

Ketik angka pilihannya.`;

const STOP_WORDS = ["stop", "berhenti", "unsubscribe"];

type Lead = {
  id: string;
  parent_name: string | null;
  child_name: string | null;
  child_age_months: number | null;
  branch_id: string | null;
  interested_program_id: string | null;
  stage: string;
  bot_status: string;
  source: string;
};

async function leadByWa(wa: string): Promise<Lead | null> {
  const rows = await query<Lead>(
    `SELECT id, parent_name, child_name, child_age_months, branch_id, interested_program_id,
            stage, bot_status, source
       FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1`,
    [wa]
  );
  return rows[0] || null;
}

async function leadBaru(wa: string): Promise<Lead> {
  const rows = await query<Lead>(
    `INSERT INTO leads (wa_number, source, bot_status, stage)
     VALUES ($1, 'whatsapp_ailsa', 'baru', 'lead_masuk')
     RETURNING id, parent_name, child_name, child_age_months, branch_id, interested_program_id, stage, bot_status, source`,
    [wa]
  );
  return rows[0];
}

async function catat(leadId: string, wa: string, direction: "masuk" | "keluar", sender: string, teks: string, olehBot: boolean, escalated = false) {
  await query(
    `INSERT INTO bot_conversations (lead_id, direction, sender, message_text, answered_by_bot, escalated)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [leadId, direction, sender, teks, olehBot, escalated]
  );
  if (direction === "masuk") {
    await query("UPDATE leads SET last_message_at = now(), updated_at = now() WHERE id = $1", [leadId]);
  }
}

async function pertanyaanTerakhir(leadId: string): Promise<string> {
  const rows = await query<{ message_text: string }>(
    `SELECT message_text FROM bot_conversations
      WHERE lead_id = $1 AND direction = 'keluar' ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );
  return (rows[0]?.message_text || "").toLowerCase();
}

async function balas(lead: Lead, wa: string, teks: string) {
  await catat(lead.id, wa, "keluar", "bot", teks, true);
  await sendText(wa, teks);
}

async function eskalasi(lead: Lead, wa: string, teks: string) {
  await catat(lead.id, wa, "keluar", "bot", teks, true, true);
  await query(
    "UPDATE bot_conversations SET escalated = true WHERE lead_id = $1 AND direction = 'masuk' AND created_at > now() - interval '1 day'",
    [lead.id]
  );
  await sendText(wa, teks);
  const admin = process.env.AILSA_HANDOFF_WA_NUMBER;
  if (admin) {
    await sendText(admin, `[AILSA] Eskalasi dari ${wa} (${lead.parent_name || "tanpa nama"}): ${teks.slice(0, 200)}`);
  }
}

export async function percakapanDieskalasi(leadId: string): Promise<boolean> {
  const rows = await query<{ escalated: boolean }>(
    `SELECT escalated FROM bot_conversations
      WHERE lead_id = $1 AND direction = 'masuk'
      ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );
  return Boolean(rows[0]?.escalated);
}

function parseUsia(teks: string): number | null {
  const t = teks.toLowerCase().replace(",", ".");
  const bulan = t.match(/(\d+(?:\.\d+)?)\s*bulan/);
  if (bulan) return Math.round(Number(bulan[1]));
  const tahun = t.match(/(\d+(?:\.\d+)?)\s*(tahun|th|thn|yo|y\.o)?/);
  if (tahun && (tahun[2] || /^\d+$/.test(t.trim()))) return Math.round(Number(tahun[1]) * 12);
  return null;
}

function cocokPengetahuan(teks: string, kandidat: Array<{ id: string; question_sample: string; answer_text: string }>) {
  const t = teks.toLowerCase();
  const kata = t.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let terbaik: { id: string; answer_text: string } | null = null;
  let skorTerbaik = 0;
  for (const item of kandidat) {
    const q = item.question_sample.toLowerCase();
    if (q.includes(t) || t.includes(q)) return item;
    const skor = kata.filter((w) => q.includes(w)).length;
    if (skor > skorTerbaik) {
      skorTerbaik = skor;
      terbaik = item;
    }
  }
  return skorTerbaik >= 1 ? terbaik : null;
}

async function infoBiaya(): Promise<string> {
  const rows = await query<{ name: string; monthly_fee: string | null }>(
    "SELECT name, monthly_fee FROM programs ORDER BY name LIMIT 10"
  );
  if (rows.length === 0) return "Informasi biaya belum tersedia. Saya teruskan ke admin ya.";
  const daftar = rows
    .map((r) => `• ${r.name}: ${r.monthly_fee ? "Rp " + Number(r.monthly_fee).toLocaleString("id-ID") + "/bulan" : "biaya menyusul"}`)
    .join("\n");
  return `Berikut program dan biaya bulanan kami:\n${daftar}\n\nKetik 2 untuk menjadwalkan trial.`;
}

async function infoLokasi(): Promise<string> {
  const rows = await query<{ name: string; city: string | null }>(
    "SELECT name, city FROM branches ORDER BY name LIMIT 10"
  );
  if (rows.length === 0) return "Detail lokasi belum tersedia. Saya teruskan ke admin ya.";
  const daftar = rows.map((r) => `• ${r.name}${r.city ? " — " + r.city : ""}`).join("\n");
  return `Kami ada di:\n${daftar}\n\nJam operasional: Senin–Jumat 07.30–16.00. Ketik 4 untuk bicara dengan admin.`;
}

export async function handleIncoming(wa: string, teksMasuk: string): Promise<void> {
  const pesan = (teksMasuk || "").trim();
  if (!pesan) return;

  let lead = await leadByWa(wa);
  if (!lead) lead = await leadBaru(wa);
  await catat(lead.id, wa, "masuk", "calon_ortu", pesan, false);

  // Berhenti: hormati permintaan, jangan kirim apa pun lagi.
  if (STOP_WORDS.includes(pesan.toLowerCase())) {
    await query("UPDATE leads SET bot_status = 'tidak_lanjut', updated_at = now() WHERE id = $1", [lead.id]);
    await balas(lead, wa, "Baik, kami berhenti mengirim pesan. Ketik apa saja bila ingin menghubungi kami lagi.");
    return;
  }

  // Percakapan yang sudah dieskalasi tidak dibalas otomatis sampai admin menutupnya.
  if (await percakapanDieskalasi(lead.id)) return;

  const t = pesan.toLowerCase();

  // Sapaan / minta menu: kirim menu tanpa menyimpan apa pun sebagai nama.
  if (["menu", "halo", "hai", "hallo", "pagi", "siang", "sore", "malam", "assalamualaikum", "mulai"].includes(t)) {
    await balas(lead, wa, MENU);
    return;
  }

  if (t === "4" || t.includes("admin") || t.includes("manusia")) {
    await eskalasi(lead, wa, "Baik, saya sambungkan ke admin kami. Mohon tunggu sebentar ya 🙏");
    return;
  }
  if (t === "1" || t.includes("biaya") || t.includes("harga") || t.includes("spp")) {
    await balas(lead, wa, await infoBiaya());
    return;
  }
  if (t === "2" || t.includes("trial") || t.includes("coba")) {
    await balas(lead, wa, "Trial gratis 1 hari. Siapa nama Bapak/Ibu?");
    return;
  }
  if (t === "3" || t.includes("lokasi") || t.includes("alamat") || t.includes("jam")) {
    await balas(lead, wa, await infoLokasi());
    return;
  }

  // Bank pengetahuan yang sudah disetujui.
  const kandidat = await query<{ id: string; question_sample: string; answer_text: string; branch_id: string | null }>(
    `SELECT id, question_sample, answer_text, branch_id FROM bot_knowledge_entries
      WHERE status = 'aktif' AND (branch_id IS NULL OR branch_id = $1)
      ORDER BY branch_id NULLS LAST LIMIT 100`,
    [lead.branch_id]
  );
  const ketemu = cocokPengetahuan(pesan, kandidat);
  if (ketemu) {
    await query("UPDATE bot_knowledge_entries SET use_count = use_count + 1, updated_at = now() WHERE id = $1", [ketemu.id]);
    await balas(lead, wa, ketemu.answer_text);
    return;
  }

  // Pengumpulan lead bertahap. Hanya menangkap jawaban bila bot memang baru
  // menanyakan hal itu — pesan tak dikenal tidak boleh disimpan sebagai nama.
  const tanya = await pertanyaanTerakhir(lead.id);
  const mintaNama = tanya.includes("siapa nama");
  const mintaAnak = tanya.includes("nama anak");
  const mintaUsia = tanya.includes("usia");
  const mintaCabang = tanya.includes("cabang mana") || tanya.includes("nomor cabang");
  const mintaProgram = tanya.includes("program apa") || tanya.includes("program yang tersedia");

  if (!lead.parent_name && (mintaNama || !tanya)) {
    await query("UPDATE leads SET parent_name = $1, updated_at = now() WHERE id = $2", [pesan.slice(0, 120), lead.id]);
    await balas(lead, wa, `Terima kasih, Bapak/Ibu ${pesan.split(" ")[0]}. Siapa nama anaknya?`);
    return;
  }
  if (!lead.child_name && mintaAnak) {
    await query("UPDATE leads SET child_name = $1, updated_at = now() WHERE id = $2", [pesan.slice(0, 120), lead.id]);
    await balas(lead, wa, `Baik, ${pesan}. Berapa usia anak sekarang? (contoh: 3 tahun)`);
    return;
  }
  if (!lead.child_age_months && mintaUsia) {
    const usia = parseUsia(pesan);
    if (!usia || usia <= 0 || usia > 216) {
      await balas(lead, wa, "Maaf, saya belum paham usianya. Boleh ditulis seperti \"3 tahun\" atau \"36 bulan\"?");
      return;
    }
    await query("UPDATE leads SET child_age_months = $1, updated_at = now() WHERE id = $2", [usia, lead.id]);
    const cabang = await query<{ id: string; name: string }>("SELECT id, name FROM branches ORDER BY name LIMIT 10");
    if (cabang.length === 1) {
      await query("UPDATE leads SET branch_id = $1, updated_at = now() WHERE id = $2", [cabang[0].id, lead.id]);
      await balas(lead, wa, `Tercatat usia ${usia} bulan. Program apa yang diminati? (contoh: Reguler / Toddler)`);
      return;
    }
    await balas(lead, wa, `Tercatat usia ${usia} bulan. Cabang mana yang diminati?\n${cabang.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}`);
    return;
  }
  if (!lead.branch_id && mintaCabang) {
    const cabang = await query<{ id: string; name: string }>("SELECT id, name FROM branches ORDER BY name LIMIT 10");
    const nomor = Number(t.replace(/\D/g, ""));
    const pilih = cabang.find((c, i) => i + 1 === nomor) || cabang.find((c) => c.name.toLowerCase().includes(t));
    if (!pilih) {
      await balas(lead, wa, `Mohon pilih nomor cabang:\n${cabang.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}`);
      return;
    }
    await query("UPDATE leads SET branch_id = $1, updated_at = now() WHERE id = $2", [pilih.id, lead.id]);
    await balas(lead, wa, `Baik, cabang ${pilih.name}. Program apa yang diminati?`);
    return;
  }
  if (!lead.interested_program_id && mintaProgram) {
    const program = await query<{ id: string; name: string }>("SELECT id, name FROM programs ORDER BY name LIMIT 10");
    const nomor = Number(t.replace(/\D/g, ""));
    const pilih = program.find((p, i) => i + 1 === nomor) || program.find((p) => p.name.toLowerCase().includes(t));
    if (!pilih) {
      await balas(lead, wa, `Program yang tersedia:\n${program.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}\nKetik nomornya ya.`);
      return;
    }
    await query("UPDATE leads SET interested_program_id = $1, updated_at = now() WHERE id = $2", [pilih.id, lead.id]);
    await balas(lead, wa, "Terima kasih! Data Bapak/Ibu sudah saya catat, admin kami akan menghubungi untuk menjadwalkan trial. Ada lagi yang bisa saya bantu?");
    const admin = process.env.AILSA_HANDOFF_WA_NUMBER;
    if (admin) {
      await sendText(admin, `[AILSA] Lead baru: ${lead.parent_name || "-"} / anak ${lead.child_name || "-"} / ${wa} / program ${pilih.name}`);
    }
    return;
  }

  // Sudah lengkap tapi belum jelas maksudnya: menu + eskalasi sopan.
  await eskalasi(lead, wa, `Maaf, saya belum punya jawaban untuk itu. Saya teruskan ke admin kami ya.\n\n${MENU}`);
}
