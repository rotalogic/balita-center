import { query } from "@/lib/db";
import { catatAudit } from "@/lib/audit";
import { panggilLLM, parseJsonLonggar } from "./llm";
import { getChildDailyReports, getChildDevelopment, getStppaReference, ringkasLaporan } from "./tools";

// Dua kemampuan tulis Ailsa untuk staf:
// 1) DRAFT laporan harian dari catatan singkat guru — selalu status draft,
//    tidak pernah terbit sendiri.
// 2) ANALISA perkembangan dari laporan PUBLISHED — disimpan sebagai artefak
//    agar bisa ditinjau guru dan tidak dihitung ulang berbeda-beda.

// Bukti dianggap sah bila kata-kata pentingnya benar-benar muncul di laporan
// periode itu. Model sering menulis "10 September 2026: bermain kartu warna"
// sementara data menyimpan "2026-09-10" — perbandingan harfiah akan salah
// menahan analisa yang sebenarnya benar.
const STOPWORD = new Set([
  "yang", "dengan", "untuk", "pada", "dari", "dalam", "tidak", "sudah", "masih",
  "anak", "guru", "laporan", "tanggal", "bulan", "hari", "secara", "dan", "atau",
  "terlihat", "menunjukkan", "konsisten", "pernah", "sering", "beberapa",
]);

export function buktiAdaDiLaporan(evidence: string, isiLaporan: string): boolean {
  const teks = String(evidence).toLowerCase();
  const kata = teks.replace(/\d/g, " ").match(/[a-z]{4,}/g) || [];
  const penting = [...new Set(kata.filter((k) => !STOPWORD.has(k)))];
  if (penting.length === 0) return true;
  const isi = isiLaporan.toLowerCase();
  const cocok = penting.filter((k) => isi.includes(k)).length;
  return cocok >= Math.max(2, Math.ceil(penting.length * 0.5));
}

const KATA_TERLARANG = ["autis", "adhd", "speech delay", "gangguan", "kelainan", "terapi", "tidak normal", "abnormal"];

type Anak = {
  id: string;
  full_name: string;
  branch_id: string;
  birth_date: string | null;
  class_id: string | null;
};

async function anakDanKelas(childId: string): Promise<Anak | null> {
  const rows = await query<Anak>(
    `SELECT c.id, c.full_name, c.branch_id, c.birth_date,
            (SELECT e.class_id FROM enrollments e
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC LIMIT 1) AS class_id
       FROM children c WHERE c.id = $1::uuid AND c.deleted_at IS NULL`,
    [childId]
  );
  return rows[0] || null;
}

async function kelasCadangan(branchId: string): Promise<string | null> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM classes WHERE branch_id = $1::uuid AND deleted_at IS NULL ORDER BY name LIMIT 1",
    [branchId]
  );
  return rows[0]?.id || null;
}

export type HasilGenerate = {
  ok: boolean;
  error?: string;
  id?: string;
  data?: Record<string, unknown>;
  ditahan?: string;
};

// ---------- 1) DRAFT LAPORAN HARIAN ----------
export async function draftLaporanHarian(opts: {
  childId: string;
  tanggal: string;
  catatan: string;
  staffId: string | null;
  userId: string;
}): Promise<HasilGenerate> {
  const anak = await anakDanKelas(opts.childId);
  if (!anak) return { ok: false, error: "Anak tidak ditemukan." };
  const classId = anak.class_id || (await kelasCadangan(anak.branch_id));
  if (!classId) return { ok: false, error: "Anak belum punya kelas aktif dan cabangnya belum punya kelas." };
  if (!opts.staffId) return { ok: false, error: "Akun Anda belum tertaut ke data staf, jadi tidak bisa membuat laporan." };

  const usiaBulan = anak.birth_date
    ? Math.floor((Date.now() - new Date(anak.birth_date).getTime()) / (30.44 * 24 * 3600 * 1000))
    : null;

  // Contoh gaya laporan sekolah: 3 laporan terakhir anak ini yang sudah terbit.
  const contoh = await query(
    `SELECT r.report_date, r.mood, r.meal_level, r.snack_level, r.nap_quality, r.notes
       FROM daily_reports r
      WHERE r.child_id = $1::uuid AND r.status = 'published' AND r.deleted_at IS NULL
      ORDER BY r.report_date DESC LIMIT 3`,
    [opts.childId]
  );

  const perintah = `Kamu menyusun DRAFT laporan harian PAUD dari catatan singkat guru.
Balas HANYA JSON: {"mood":"sedih|cemas|biasa|ceria|sangat_ceria","meal_level":"tidak|sedikit|cukup|banyak",
"snack_level":"tidak|sedikit|cukup|banyak","nap_quality":"buruk|cukup|baik|sangat_baik","nap_start":"HH:mm|null",
"nap_end":"HH:mm|null","toilet_pee_count":0,"toilet_poop_count":0,"meals_text":"...","snack_text":"...",
"mood_notes":"...","notes":"...","activities":[{"title":"...","apparatus":"...","area":"...","rating":1-5,"activity_time":"HH:mm","notes":"..."}]}
Aturan: hanya tulis fakta yang ada di catatan guru; jangan menambah kejadian yang tidak disebut.
Rating 1-5 mencerminkan keterlibatan anak menurut catatan. 1–4 aktivitas. Bahasa Indonesia hangat dan konkret.
JANGAN memakai istilah diagnosis (autis, ADHD, gangguan, kelainan, terapi).`;

  const bahan = {
    anak: anak.full_name,
    usia_bulan: usiaBulan,
    tanggal: opts.tanggal,
    catatan_guru: opts.catatan,
    contoh_laporan_terbit: contoh,
  };

  const hasil = await panggilLLM([
    { role: "system", content: perintah },
    { role: "user", content: JSON.stringify(bahan) },
  ]);
  if (!hasil.ok || !hasil.teks) return { ok: false, error: `LLM gagal: ${hasil.error || "kosong"}` };
  const j = parseJsonLonggar(hasil.teks);
  if (!j) return { ok: false, error: "Jawaban model bukan JSON yang sah." };

  const teksSemua = JSON.stringify(j).toLowerCase();
  const label = KATA_TERLARANG.find((k) => teksSemua.includes(k));
  if (label) return { ok: false, ditahan: `label_medis:${label}`, error: "Draf ditahan: ada istilah diagnosis yang tidak boleh dipakai." };

  const aktivitas = (Array.isArray(j.activities) ? j.activities : []).slice(0, 4) as Array<Record<string, unknown>>;
  if (aktivitas.length === 0) return { ok: false, error: "Model tidak menghasilkan aktivitas; draf tidak dibuat." };

  const rows = await query<{ id: string }>(
    `INSERT INTO daily_reports (branch_id, child_id, class_id, created_by, report_date, mood, mood_notes,
            meal_level, meals_text, snack_level, snack_text, nap_quality, nap_start, nap_end,
            toilet_pee_count, toilet_poop_count, toilet_count, notes, status, lead_facilitator_id)
     VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',$4)
     RETURNING id`,
    [
      anak.branch_id, anak.id, classId, opts.staffId, opts.tanggal,
      String(j.mood || "biasa"), String(j.mood_notes || "") || null,
      String(j.meal_level || "cukup"), String(j.meals_text || "") || null,
      String(j.snack_level || "cukup"), String(j.snack_text || "") || null,
      String(j.nap_quality || "baik"),
      (j.nap_start as string) || null, (j.nap_end as string) || null,
      Number(j.toilet_pee_count || 0), Number(j.toilet_poop_count || 0),
      Number(j.toilet_pee_count || 0) + Number(j.toilet_poop_count || 0),
      String(j.notes || "") || null,
    ]
  );
  const reportId = rows[0].id;

  for (const [i, a] of aktivitas.entries()) {
    await query(
      `INSERT INTO daily_report_activities (report_id, title, apparatus, area, rating, activity_time, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        reportId, String(a.title || "Aktivitas"), String(a.apparatus || "") || null,
        String(a.area || "") || null, Number(a.rating || 3) || 3,
        (a.activity_time as string) || null, String(a.notes || "") || null, i,
      ]
    );
  }

  await catatAudit({ id: opts.userId }, {
    action: "ailsa.draft_report",
    entityTable: "daily_reports",
    entityId: reportId,
    branchId: anak.branch_id,
    detail: { anak: anak.full_name, tanggal: opts.tanggal, aktivitas: aktivitas.length, status: "draft" },
  });

  return { ok: true, id: reportId, data: { status: "draft", aktivitas: aktivitas.length } };
}

// ---------- 2) ANALISA PERKEMBANGAN ----------
export async function analisaPerkembangan(opts: {
  childId: string;
  dari: string;
  sampai: string;
  userId: string;
}): Promise<HasilGenerate> {
  const anak = await anakDanKelas(opts.childId);
  if (!anak) return { ok: false, error: "Anak tidak ditemukan." };

  const { laporan, aktivitas } = await getChildDailyReports(opts.childId, opts.dari, opts.sampai);
  if (laporan.length < 3) {
    return {
      ok: false,
      error: `Data belum cukup: hanya ${laporan.length} laporan terbit pada ${opts.dari}–${opts.sampai}. Minimal 3 laporan.`,
      data: { published_reports_count: laporan.length },
    };
  }

  const dev = await getChildDevelopment(opts.childId);
  const usiaBulan = anak.birth_date
    ? Math.floor((Date.now() - new Date(anak.birth_date).getTime()) / (30.44 * 24 * 3600 * 1000))
    : 36;
  const kelompok = ["0-1 tahun", "1-2 tahun", "2-3 tahun", "3-4 tahun", "4-5 tahun", "5-6 tahun"][Math.min(5, Math.floor(usiaBulan / 12))];
  const stppa = await getStppaReference(kelompok);

  const perintah = `Kamu menyusun ANALISA PERKEMBANGAN internal untuk guru, dari laporan harian yang terbit.
Balas HANYA JSON: {"ringkasan":"...","aspects":[{"aspect":"Nilai Agama & Moral|Motorik Kasar|Motorik Halus|Bahasa|Kognitif|Sosial Emosional|Kemandirian","level":"berkembang pesat|berkembang sesuai tahap|mulai berkembang|perlu perhatian dan stimulasi","evidence":["tanggal: bukti dari laporan"]}],"strengths":["..."],"growth_areas":["..."],"class_stimulation":["usul aktivitas kelas minggu depan"],"home_activity":"saran aktivitas rumah sebagai bahan internal guru","needs_teacher_review":false}
Aturan wajib:
- Sebut dasar data (jumlah laporan + periode) di "ringkasan".
- Setiap "evidence" HANYA kutipan pendek dari laporan + tanggalnya (maks 12 kata), bukan penjelasan.
- Aspek tanpa bukti cukup: level "mulai berkembang" dan sebutkan datanya tipis.
- DILARANG: diagnosis/label medis, perbandingan dengan anak lain, nilai/peringkat/persentase.
- Bila pola mengkhawatirkan, jangan simpulkan penyebab: set needs_teacher_review true.`;

  const hasil = await panggilLLM([
    { role: "system", content: perintah },
    {
      role: "user",
      content: JSON.stringify({
        anak: anak.full_name,
        periode: { dari: opts.dari, sampai: opts.sampai },
        jumlah_laporan_terbit: laporan.length,
        ringkasan_terstruktur: ringkasLaporan(laporan, aktivitas),
        aktivitas: aktivitas.slice(0, 40),
        catatan_perkembangan: dev.catatan,
        capaian_stppa: dev.capaian.slice(0, 30),
        kerangka_stppa: stppa.slice(0, 25),
      }),
    },
  ]);
  if (!hasil.ok || !hasil.teks) return { ok: false, error: `LLM gagal: ${hasil.error || "kosong"}` };
  const j = parseJsonLonggar(hasil.teks);
  if (!j) return { ok: false, error: "Jawaban model bukan JSON yang sah." };

  const teks = JSON.stringify(j).toLowerCase();
  const label = KATA_TERLARANG.find((k) => teks.includes(k));
  if (label) return { ok: false, ditahan: `label_medis:${label}`, error: "Analisa ditahan: ada istilah diagnosis." };

  // Bukti yang tidak ditemukan di laporan dibuang, dan aspeknya diturunkan ke
  // "mulai berkembang" — aturan dokumen: aspek tanpa bukti tidak boleh diberi
  // level lebih tinggi. Analisa tetap dipakai, tidak dibuang seluruhnya.
  const isiLaporan = JSON.stringify(laporan) + JSON.stringify(aktivitas);
  const aspects = (Array.isArray(j.aspects) ? j.aspects : []) as Array<{ aspect?: string; level?: string; evidence?: string[] }>;
  let buktiDibuang = 0;
  j.aspects = aspects.map((a) => {
    const sah = (a.evidence || []).filter((e) => buktiAdaDiLaporan(String(e), isiLaporan));
    buktiDibuang += (a.evidence || []).length - sah.length;
    return sah.length > 0 ? { ...a, evidence: sah } : { ...a, level: "mulai berkembang", evidence: [] };
  });
  if (buktiDibuang > 0) {
    j.catatan_pengawalan = `${buktiDibuang} kutipan tanpa dasar dibuang; aspek terkait diturunkan ke "mulai berkembang".`;
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO ailsa_analyses (child_id, period_start, period_end, published_count, content, model, needs_teacher_review, created_by)
     VALUES ($1::uuid,$2::date,$3::date,$4,$5::jsonb,$6,$7,$8::uuid) RETURNING id`,
    [
      opts.childId, opts.dari, opts.sampai, laporan.length, JSON.stringify(j),
      process.env.LLM_MODEL || "deepseek-chat", Boolean(j.needs_teacher_review), opts.userId,
    ]
  );

  await catatAudit({ id: opts.userId }, {
    action: "ailsa.analysis",
    entityTable: "ailsa_analyses",
    entityId: rows[0].id,
    branchId: anak.branch_id,
    detail: { anak: anak.full_name, laporan: laporan.length, periode: `${opts.dari}..${opts.sampai}` },
  });

  return { ok: true, id: rows[0].id, data: { ...j, published_reports_count: laporan.length } };
}
