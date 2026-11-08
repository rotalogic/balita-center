import { query } from "@/lib/db";

// Pengawalan SETELAH model menjawab. Model tidak dipercaya untuk patuh sendiri:
// nominal uang, data anak, dan confidence diperiksa di kode sebelum terkirim.
export type Keluaran = {
  reply: string;
  intent: string;
  state: string;
  lead: {
    nama_orang_tua?: string | null;
    nama_anak?: string | null;
    usia_anak_bulan?: number | null;
    cabang?: string | null;
    program?: string | null;
    consent?: boolean;
  };
  need_admin: boolean;
  priority: "normal" | "tinggi";
  opt_out: boolean;
  unanswered_question: string | null;
  development_analysis: Record<string, unknown> | null;
  knowledge_ids: string[];
  confidence: number;
};

const INTENT_PERLU_PENGETAHUAN = ["info", "biaya", "lokasi", "trial", "tagihan"];

const KATA_TERLARANG = [
  "autis", "autisme", "adhd", "speech delay", "keterlambatan bicara", "gangguan", "kelainan",
  "terapi", "disleksia", "hiperaktif", "tidak normal", "abnormal", "retardasi", "down syndrome",
];

// Ambil HANYA angka yang benar-benar berperan sebagai nominal uang:
// berawalan "Rp", atau bertitik ribuan (500.000), atau >= 5 digit (150000).
// Tahun seperti 2026 dan tanggal tidak ikut diperiksa.
function nominalDalamTeks(teks: string): string[] {
  const hasil = new Set<string>();
  const pola = /(?:rp\.?\s*)(\d{1,3}(?:[.,]\d{3})*|\d+)|(\d{1,3}(?:\.\d{3})+)|\b(\d{5,})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(teks))) {
    const angka = (m[1] || m[2] || m[3] || "").replace(/[.,]/g, "");
    if (!angka) continue;
    if (/^(19|20)\d{2}$/.test(angka)) continue; // tahun
    hasil.add(angka);
  }
  return [...hasil];
}

function normalNominal(teks: string): Set<string> {
  return new Set(nominalDalamTeks(teks));
}

export type HasilGuard = { kirim: boolean; reply: string; alasan?: string; eskalasi?: boolean };

export async function jagaJawaban(
  keluar: Keluaran,
  konteks: {
    sesiStaf: boolean;
    waliTerverifikasi: boolean;
    namaAnakSesi: string[];
    bahanNominal: string; // gabungan teks pengetahuan + data tool giliran ini
    publishedCount?: number;
    isiLaporan?: string;
  }
): Promise<HasilGuard> {
  // 1) Nominal uang harus ada di bahan giliran ini.
  const nominalDipakai = nominalDalamTeks(keluar.reply);
  const tersedia = normalNominal(konteks.bahanNominal);
  const nominalAsing = nominalDipakai.filter((n) => n.length >= 3 && !tersedia.has(n));
  if (nominalAsing.length > 0) {
    return {
      kirim: false,
      eskalasi: true,
      alasan: `nominal_tidak_terground:${nominalAsing.join("|")}`,
      reply: "Baik, saya teruskan ke admin Balita Center ya supaya angkanya tepat. Admin akan membalas di chat ini pada jam operasional.",
    };
  }

  // 2) Intent yang butuh sumber, tapi tidak memakai satu pun butir pengetahuan
  //    dan tidak ada data tool -> perlakukan sebagai tak terjawab.
  if (!konteks.sesiStaf && INTENT_PERLU_PENGETAHUAN.includes(keluar.intent) && keluar.knowledge_ids.length === 0) {
    const adaData = konteks.bahanNominal.trim().length > 0;
    if (!adaData) {
      return {
        kirim: false,
        eskalasi: true,
        alasan: "tanpa_sumber_pengetahuan",
        reply: "Untuk itu saya perlu pastikan ke admin dulu ya. Saya teruskan pertanyaannya, dibalas pada jam operasional.",
      };
    }
  }

  // 3) Data anak hanya untuk wali terverifikasi miliknya sendiri, ATAU staf
  //    (sesi staf memang bertugas melihat data anak di cabangnya).
  if (!konteks.waliTerverifikasi && !konteks.sesiStaf) {
    const anakLain = await query<{ full_name: string }>(
      "SELECT full_name FROM children WHERE deleted_at IS NULL"
    );
    const bocor = anakLain.filter((a) => a.full_name && keluar.reply.toLowerCase().includes(a.full_name.toLowerCase()));
    if (bocor.length > 0 || keluar.intent === "status_anak") {
      return {
        kirim: false,
        eskalasi: true,
        alasan: "data_anak_tanpa_verifikasi",
        reply: "Maaf, data anak hanya bisa saya tampilkan setelah verifikasi wali. Bisa dibantu admin lewat chat ini ya.",
      };
    }
  }

  // 4) Analisa: hanya staf, angka dasar wajib cocok, evidence wajib ada, tanpa label medis.
  if (keluar.development_analysis) {
    if (!konteks.sesiStaf) {
      return {
        kirim: false,
        alasan: "analisa_untuk_orang_tua",
        reply:
          "Analisa perkembangan adalah dokumen kerja internal sekolah. Yang bisa Anda lihat adalah Daily Report dan rapor resmi yang diterbitkan guru lewat Balita Connect.",
      };
    }
    const klaim = Number(keluar.development_analysis.published_reports_count || 0);
    if (typeof konteks.publishedCount === "number" && klaim !== konteks.publishedCount) {
      return {
        kirim: false,
        eskalasi: true,
        alasan: `jumlah_laporan_tidak_cocok:${klaim}vs${konteks.publishedCount}`,
        reply: "Draf analisanya saya tahan dulu — jumlah laporan yang saya hitung tidak cocok dengan data. Saya minta guru meninjau ulang.",
      };
    }
    const teksAnalisa = JSON.stringify(keluar.development_analysis) + " " + keluar.reply;
    const label = KATA_TERLARANG.find((k) => teksAnalisa.toLowerCase().includes(k));
    if (label) {
      return {
        kirim: false,
        eskalasi: true,
        alasan: `label_medis:${label}`,
        reply: "Draf analisanya saya tahan dan teruskan ke guru untuk ditinjau, karena ada istilah yang tidak boleh saya pakai.",
      };
    }
    // Kutipan tanpa dasar sudah dibersihkan dan level diturunkan di generate.ts;
    // di sini cukup pastikan jumlah laporan dan larangan label medis.
  }

  // 5) Confidence rendah tanpa eskalasi/klarifikasi -> paksa eskalasi.
  if (keluar.confidence < 0.7 && !keluar.need_admin && keluar.state !== "kumpul_lead") {
    return {
      kirim: false,
      eskalasi: true,
      alasan: `confidence_rendah:${keluar.confidence}`,
      reply: "Saya belum yakin jawabannya tepat, jadi saya teruskan ke admin ya. Admin akan membalas di chat ini pada jam operasional.",
    };
  }

  return { kirim: true, reply: keluar.reply };
}

export function keluaranKosong(): Keluaran {
  return {
    reply: "",
    intent: "tidak_diketahui",
    state: "menu",
    lead: {},
    need_admin: false,
    priority: "normal",
    opt_out: false,
    unanswered_question: null,
    development_analysis: null,
    knowledge_ids: [],
    confidence: 0,
  };
}

// Normalisasi keluaran model: field hilang/kepanjangan tidak boleh memecah bot.
export function rapikanKeluaran(mentah: Record<string, unknown>): Keluaran {
  const dasar = keluaranKosong();
  const lead = (mentah.lead || {}) as Record<string, unknown>;
  return {
    reply: typeof mentah.reply === "string" ? mentah.reply.trim() : dasar.reply,
    intent: typeof mentah.intent === "string" ? mentah.intent : dasar.intent,
    state: typeof mentah.state === "string" ? mentah.state : dasar.state,
    lead: {
      nama_orang_tua: (lead.nama_orang_tua as string) ?? null,
      nama_anak: (lead.nama_anak as string) ?? null,
      usia_anak_bulan: lead.usia_anak_bulan ? Number(lead.usia_anak_bulan) : null,
      cabang: (lead.cabang as string) ?? null,
      program: (lead.program as string) ?? null,
      consent: Boolean(lead.consent),
    },
    need_admin: Boolean(mentah.need_admin),
    priority: mentah.priority === "tinggi" ? "tinggi" : "normal",
    opt_out: Boolean(mentah.opt_out),
    unanswered_question: typeof mentah.unanswered_question === "string" ? mentah.unanswered_question : null,
    development_analysis: (mentah.development_analysis as Record<string, unknown>) ?? null,
    knowledge_ids: Array.isArray(mentah.knowledge_ids) ? (mentah.knowledge_ids as string[]).map(String) : [],
    confidence: Number(mentah.confidence ?? 0),
  };
}
