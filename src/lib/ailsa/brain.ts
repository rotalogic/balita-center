import { query } from "@/lib/db";
import { rapikanLead } from "@/lib/lead";
import { SYSTEM_PROMPT_AILSA } from "./system-prompt";
import { panggilLLM, parseJsonLonggar, llmConfigured, segarkanKonfigurasi } from "./llm";
import { jagaJawaban, rapikanKeluaran, type Keluaran } from "./guard";
import {
  cariPengetahuan, getBranchInfo, getChildDailyReports, getChildDevelopment,
  getChildOpenBills, getChildPublishedReports, getPrograms, getStppaReference,
  getTrialSlots, ringkasLaporan, tandaiPengetahuanDipakai,
} from "./tools";

export type HasilGiliran = {
  tool: string[];
  pengetahuan_ids: string[];
  keluaran: Keluaran;
  balasan: string;
  dikirim: boolean;
  eskalasi: boolean;
  alasanBlokir?: string;
  sumber: "llm" | "aturan";
  llmError?: string;
};

type Sesi = {
  wa: string;
  leadId: string | null;
  staffId: string | null;
  guardianId: string | null;
  anakIds: string[];
  namaAnak: string[];
  state: Record<string, unknown>;
};

export async function siapkanSesi(wa: string): Promise<Sesi> {
  const lead = await query<{ id: string; ailsa_state: Record<string, unknown> | null; guardian_id: string | null; opt_out: boolean }>(
    "SELECT id, ailsa_state, guardian_id, opt_out FROM leads WHERE wa_number = $1 ORDER BY created_at DESC LIMIT 1",
    [wa]
  );
  const staf = await query<{ id: string }>("SELECT id FROM staff WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 LIMIT 1", [
    wa.replace(/\D/g, ""),
  ]);
  const wali = await query<{ id: string }>(
    "SELECT id FROM guardians WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 LIMIT 1",
    [wa.replace(/\D/g, "")]
  );
  const anak = wali[0]
    ? await query<{ id: string; full_name: string }>(
        `SELECT c.id, c.full_name FROM children c JOIN child_guardians cg ON cg.child_id = c.id
          WHERE cg.guardian_id = $1 AND c.deleted_at IS NULL`,
        [wali[0].id]
      )
    : [];
  return {
    wa,
    leadId: lead[0]?.id ?? null,
    staffId: staf[0]?.id ?? null,
    guardianId: wali[0]?.id ?? null,
    anakIds: anak.map((a) => a.id),
    namaAnak: anak.map((a) => a.full_name),
    state: (lead[0]?.ailsa_state as Record<string, unknown>) || {},
  };
}

function potongTanggal(teks: string): { dari: string; sampai: string } {
  const hariIni = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const t = teks.toLowerCase();
  if (t.includes("bulan lalu")) {
    const mulai = new Date(hariIni.getFullYear(), hariIni.getMonth() - 1, 1);
    const akhir = new Date(hariIni.getFullYear(), hariIni.getMonth(), 0);
    return { dari: iso(mulai), sampai: iso(akhir) };
  }
  if (t.includes("semester") || t.includes("6 bulan")) {
    const mulai = new Date(hariIni);
    mulai.setMonth(mulai.getMonth() - 6);
    return { dari: iso(mulai), sampai: iso(hariIni) };
  }
  const mulai = new Date(hariIni);
  mulai.setDate(mulai.getDate() - 30);
  return { dari: iso(mulai), sampai: iso(hariIni) };
}

// Satu giliran percakapan: susun konteks -> model -> pengawalan -> balasan.
export type Persona = "calon" | "wali" | "wali_belum" | "staf";

export async function giliranAilsa(
  wa: string,
  pesanMasuk: string,
  paksaStaff?: { staffId: string; nama?: string },
  persona?: Persona,
  anakPilihan?: string
): Promise<HasilGiliran> {
  const sesi = await siapkanSesi(wa);
  // Sesi web untuk staf: nomor HP tidak selalu terdaftar, jadi identitas staf
  // diberikan oleh pemanggil yang sudah lewat guard RBAC.
  if (paksaStaff) sesi.staffId = paksaStaff.staffId;
  // Simulator boleh memaksa persona; WhatsApp selalu memakai identitas sebenarnya.
  let sesiStaf = Boolean(sesi.staffId);
  let waliTerverifikasi = Boolean(sesi.guardianId) && sesi.anakIds.length > 0;
  if (persona === "staf") sesiStaf = true;
  if (persona === "calon" || persona === "wali_belum") { sesiStaf = false; waliTerverifikasi = false; }
  if (persona === "wali" && anakPilihan) { waliTerverifikasi = true; sesi.anakIds = [anakPilihan]; }

  const pengetahuan = await cariPengetahuan(pesanMasuk);
  const tool: string[] = ["getPrograms", "getBranchInfo", "getTrialSlots"];
  const [programs, branches, slots] = await Promise.all([getPrograms(), getBranchInfo(), getTrialSlots(null)]);

  // Data anak hanya diambil untuk nomor wali terverifikasi.
  const { dari, sampai } = potongTanggal(pesanMasuk);
  const laporan = waliTerverifikasi ? await getChildPublishedReports(sesi.anakIds, dari, sampai) : [];
  const tagihan = waliTerverifikasi && sesi.guardianId ? await getChildOpenBills(sesi.guardianId) : [];
  if (waliTerverifikasi) { tool.push("getChildPublishedReports"); if (sesi.guardianId) tool.push("getChildOpenBills"); }

  // Tool analisa hanya untuk sesi staf.
  let analisaBahan: Record<string, unknown> | null = null;
  let publishedCount: number | undefined;
  let isiLaporan = "";
  if (sesiStaf && /analis|perkembangan|rapor|ringkas/i.test(pesanMasuk)) {
    const anakDiminta = await query<{ id: string; full_name: string; birth_date: string | null }>(
      `SELECT c.id, c.full_name, c.birth_date FROM children c WHERE c.deleted_at IS NULL
        AND ($1 = '' OR c.full_name ILIKE '%' || $1 || '%') ORDER BY c.full_name LIMIT 1`,
      [String((sesi.state.anak_diminta as string) || "")]
    );
    if (anakDiminta[0]) {
      const anak = anakDiminta[0];
      tool.push("getChildDailyReports", "getChildDevelopment", "getStppaReference");
      const { laporan: lap, aktivitas } = await getChildDailyReports(anak.id, dari, sampai);
      const dev = await getChildDevelopment(anak.id);
      const usiaBulan = anak.birth_date
        ? Math.floor((Date.now() - new Date(anak.birth_date).getTime()) / (30.44 * 24 * 3600 * 1000))
        : 36;
      const kelompik = ["0-1 tahun", "1-2 tahun", "2-3 tahun", "3-4 tahun", "4-5 tahun", "5-6 tahun"][Math.min(5, Math.floor(usiaBulan / 12))];
      const stppa = await getStppaReference(kelompik);
      publishedCount = lap.length;
      isiLaporan = JSON.stringify(lap) + JSON.stringify(aktivitas);
      analisaBahan = {
        child_id: anak.id,
        child_name: anak.full_name,
        period_start: dari,
        period_end: sampai,
        published_reports_count: lap.length,
        ringkasan: ringkasLaporan(lap, aktivitas),
        perkembangan: dev,
        kerangka_stppa: stppa.slice(0, 30),
      };
    }
  }

  const dataSekolah = {
    programs,
    branches,
    trial_slots: slots,
    ...(waliTerverifikasi ? { anak: sesi.namaAnak, laporan_terbit: laporan, tagihan } : {}),
    ...(analisaBahan ? { analisa: analisaBahan } : {}),
  };

  const riwayat = sesi.leadId
    ? await query<{ direction: string; message_text: string }>(
        `SELECT direction, message_text FROM bot_conversations
          WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 8`,
        [sesi.leadId]
      )
    : [];

  const konteks = [
    `[PENGETAHUAN]`,
    pengetahuan.length
      ? pengetahuan.map((p) => `- ID ${p.id} | T: ${p.tanya} | J: ${p.jawab}`).join("\n")
      : "(tidak ada butir pengetahuan aktif yang cocok)",
    ``,
    `[DATA]`,
    JSON.stringify(dataSekolah),
    ``,
    `[SESI] wali_terverifikasi: ${waliTerverifikasi}; sesi_staf: ${sesiStaf}; state_lead: ${JSON.stringify(sesi.state)}`,
    riwayat.length ? `[RIWAYAT]\n${riwayat.reverse().map((r) => `${r.direction === "masuk" ? "Pengguna" : "Ailsa"}: ${r.message_text}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await segarkanKonfigurasi();
  if (!llmConfigured()) {
    return {
      tool,
      pengetahuan_ids: [],
      keluaran: rapikanKeluaran({}),
      balasan: "Layanan Ailsa sedang tidak aktif. Silakan hubungi admin Balita Center ya.",
      dikirim: false,
      eskalasi: true,
      alasanBlokir: "llm_belum_dikonfigurasi",
      sumber: "aturan",
    };
  }

  const hasil = await panggilLLM([
    { role: "system", content: SYSTEM_PROMPT_AILSA },
    { role: "system", content: konteks },
    { role: "user", content: pesanMasuk },
  ]);

  if (!hasil.ok || !hasil.teks) {
    return {
      tool,
      pengetahuan_ids: [],
      keluaran: rapikanKeluaran({}),
      balasan: "Maaf, saya ulangi ya — sistem saya sedang lambat. Boleh kirim ulang pesannya?",
      dikirim: false,
      eskalasi: true,
      alasanBlokir: hasil.error || "llm_gagal",
      sumber: "aturan",
      llmError: hasil.error,
    };
  }

  const json = parseJsonLonggar(hasil.teks);
  if (!json) {
    return {
      tool,
      pengetahuan_ids: [],
      keluaran: rapikanKeluaran({}),
      balasan: "Maaf, saya ulangi ya. Boleh kirim ulang pertanyaannya?",
      dikirim: false,
      eskalasi: true,
      alasanBlokir: "json_tidak_valid",
      sumber: "llm",
    };
  }

  const keluaran = rapikanKeluaran(json);
  const jaga = await jagaJawaban(keluaran, {
    sesiStaf,
    waliTerverifikasi,
    namaAnakSesi: sesi.namaAnak,
    bahanNominal: [
      ...pengetahuan.map((p) => p.jawab),
      JSON.stringify(programs),
      JSON.stringify(laporan),
      JSON.stringify(tagihan),
    ].join(" "),
    publishedCount,
    isiLaporan,
  });

  if (pengetahuan.length > 0) {
    await tandaiPengetahuanDipakai(pengetahuan.map((p) => p.id));
  }

  return {
    tool,
    // Sitasi = irisan butir yang diambil dari bank DAN dipakai model.
    pengetahuan_ids: pengetahuan
      .filter((p) => (keluaran.knowledge_ids || []).length === 0 || (keluaran.knowledge_ids || []).includes(p.id))
      .map((p) => p.id),
    keluaran,
    balasan: jaga.reply || keluaran.reply,
    dikirim: jaga.kirim,
    eskalasi: Boolean(jaga.eskalasi) || keluaran.need_admin || Boolean(jaga.alasan),
    alasanBlokir: jaga.alasan || (keluaran.need_admin ? "model_minta_admin" : undefined),
    sumber: "llm",
  };
}

// Lead dibuat HANYA bila lengkap + consent. Satu nomor = satu baris lead:
// baris kosong yang dibuat webhook saat kontak pertama diisi di tempat,
// bukan ditambah baris kedua (dulu menghasilkan lead ganda).
export async function simpanLeadDariKeluaran(wa: string, keluaran: Keluaran, leadId: string | null) {
  const l = keluaran.lead || {};
  if (!l.nama_anak || !l.consent) return { dibuat: false };
  const rapi = rapikanLead(l.nama_orang_tua, l.nama_anak, l.usia_anak_bulan);

  const target =
    leadId ||
    (
      await query<{ id: string; child_name: string | null }>(
        `SELECT id, child_name FROM leads WHERE wa_number = $1 AND stage <> 'ditolak'
          ORDER BY (child_name IS NOT NULL) DESC, created_at ASC LIMIT 1`,
        [wa]
      )
    )[0]?.id;

  if (!target) {
    const rows = await query<{ id: string }>(
      `INSERT INTO leads (wa_number, parent_name, child_name, child_age_months, source, bot_status, stage, ailsa_state)
       VALUES ($1,$2,$3,$4,'whatsapp_ailsa','baru','lead_masuk',$5::jsonb) RETURNING id`,
      [wa, rapi.parent_name, rapi.child_name, rapi.child_age_months, JSON.stringify(keluaran)]
    );
    return { dibuat: true, id: rows[0].id };
  }

  await query(
    `UPDATE leads SET parent_name = COALESCE($2, parent_name), child_name = COALESCE($3, child_name),
            child_age_months = COALESCE($4, child_age_months),
            bot_status = 'sudah_kirim_data', ailsa_state = $5::jsonb, updated_at = now()
      WHERE id = $1`,
    [target, rapi.parent_name, rapi.child_name, rapi.child_age_months, JSON.stringify(keluaran)]
  );
  return { dibuat: false, id: target };
}
