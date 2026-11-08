import { query } from "@/lib/db";

// Tool data sekolah untuk Ailsa. Semua angka yang boleh disebut Ailsa berasal
// dari sini — bukan dari ingatan model. Tool analisa hanya dipanggil untuk sesi
// staf (dijaga di brain.ts).
export type PotonganPengetahuan = { id: string; tanya: string; jawab: string };

// Pencarian sederhana: kata kunci + skor tumpang tindih.
// ponytail: tanpa embedding; ganti pgvector bila bank pengetahuan > ~200 butir.
// Penghitung "Dipakai" untuk tiap butir yang benar-benar dipakai menjawab.
export async function tandaiPengetahuanDipakai(ids: string[]) {
  if (ids.length === 0) return;
  await query(
    "UPDATE bot_knowledge_entries SET use_count = COALESCE(use_count,0) + 1 WHERE id = ANY($1::uuid[])",
    [ids]
  ).catch(() => null);
}

export async function cariPengetahuan(pertanyaan: string, branchId?: string | null, batas = 5): Promise<PotonganPengetahuan[]> {
  const rows = await query<{ id: string; question_sample: string; answer_text: string }>(
    `SELECT id, question_sample, answer_text FROM bot_knowledge_entries
      WHERE status IN ('aktif', 'disetujui')
        AND ($1::uuid IS NULL OR branch_id IS NULL OR branch_id = $1::uuid)
      ORDER BY use_count DESC, updated_at DESC LIMIT 200`,
    [branchId || null]
  );
  const kata = pertanyaan
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length > 2);
  const skor = rows.map((r) => {
    const teks = `${r.question_sample} ${r.answer_text}`.toLowerCase();
    return { r, n: kata.filter((k) => teks.includes(k)).length };
  });
  const cocok = skor.filter((s) => s.n > 0).sort((a, b) => b.n - a.n).slice(0, batas);
  const dipakai = cocok.length > 0 ? cocok : skor.slice(0, Math.min(2, skor.length));
  return dipakai.map((s) => ({ id: s.r.id, tanya: s.r.question_sample, jawab: s.r.answer_text }));
}

export async function getPrograms() {
  // programs tidak punya branch_id; biaya berlaku sekolah-wide.
  return query(
    `SELECT name, code, monthly_fee, screening_fee, age_min_months, age_max_months
       FROM programs WHERE deleted_at IS NULL AND is_active ORDER BY name`
  );
}

export async function getBranchInfo() {
  // branches tidak menyimpan phone/email/opening_hours di skema ini.
  return query(
    `SELECT name, code, city, address, timezone FROM branches
      WHERE deleted_at IS NULL AND is_active ORDER BY name`
  );
}

export async function getTrialSlots(branchId?: string | null) {
  return query(
    `SELECT b.name AS branch, c.name AS kelas, p.name AS program
       FROM classes c
       JOIN branches b ON b.id = c.branch_id
       LEFT JOIN programs p ON p.id = c.program_id
      WHERE ($1::uuid IS NULL OR c.branch_id = $1::uuid) AND c.is_active AND c.deleted_at IS NULL
      ORDER BY b.name, c.name LIMIT 30`,
    [branchId || null]
  );
}

// HANYA untuk nomor wali terverifikasi.
export async function getChildPublishedReports(childIds: string[], dari: string, sampai: string) {
  if (childIds.length === 0) return [];
  return query(
    `SELECT r.id, r.report_date, c.full_name AS child_name, r.mood, r.meal_level, r.snack_level,
            r.nap_quality, r.nap_start, r.nap_end, r.toilet_pee_count, r.toilet_poop_count,
            r.notes, r.mood_notes
       FROM daily_reports r JOIN children c ON c.id = r.child_id
      WHERE r.child_id = ANY($1::uuid[]) AND r.status = 'published' AND r.deleted_at IS NULL
        AND r.report_date BETWEEN $2::date AND $3::date
      ORDER BY r.report_date DESC LIMIT 40`,
    [childIds, dari, sampai]
  );
}

export async function getChildOpenBills(guardianId: string) {
  return query(
    `SELECT i.id, i.period_month, i.amount, i.due_date, i.status, c.full_name AS child_name
       FROM invoices i
       JOIN children c ON c.id = i.child_id
       JOIN child_guardians cg ON cg.child_id = c.id
      WHERE cg.guardian_id = $1::uuid AND i.status <> 'lunas'
      ORDER BY i.due_date LIMIT 20`,
    [guardianId]
  );
}

// ---- Tool analisa (SESI STAF SAJA) ----

export async function getChildDailyReports(childId: string, dari: string, sampai: string) {
  const laporan = await query<Record<string, unknown>>(
    `SELECT r.id, r.report_date, r.mood, r.meal_level, r.snack_level, r.nap_quality,
            r.nap_start, r.nap_end, r.toilet_pee_count, r.toilet_poop_count,
            r.notes, r.mood_notes
       FROM daily_reports r
      WHERE r.child_id = $1::uuid AND r.status = 'published' AND r.deleted_at IS NULL
        AND r.report_date BETWEEN $2::date AND $3::date
      ORDER BY r.report_date`,
    [childId, dari, sampai]
  );
  const ids = laporan.map((r) => String(r.id));
  const aktivitas = ids.length
    ? await query(
        `SELECT report_id, title, apparatus, area, rating, notes, activity_time
           FROM daily_report_activities WHERE report_id = ANY($1::uuid[])
          ORDER BY report_id, sort_order`,
        [ids]
      )
    : [];
  return { laporan, aktivitas };
}

export async function getChildDevelopment(childId: string) {
  const [catatan, capaian] = await Promise.all([
    // Tabel ini menyimpan persentase per aspek, bukan baris per catatan aspek.
    query(
      `SELECT recorded_on, physical_pct, gross_motor_pct, fine_motor_pct,
              cognitive_pct, language_pct, social_emotional_pct, independence_pct,
              teacher_notes, parent_recommendations
         FROM child_development_records
        WHERE child_id = $1::uuid ORDER BY recorded_on DESC LIMIT 12`,
      [childId]
    ),
    query(
      `SELECT s.assessed_at, i.aspect, i.item_text, s.achieved
         FROM stppa_assessments s JOIN stppa_items i ON i.id = s.item_id
        WHERE s.child_id = $1::uuid ORDER BY s.assessed_at DESC LIMIT 60`,
      [childId]
    ),
  ]);
  return { catatan, capaian };
}

export async function getStppaReference(ageGroup: string) {
  return query(
    `SELECT aspect, item_text FROM stppa_items
      WHERE age_group = $1 AND is_active ORDER BY aspect, sort_order LIMIT 80`,
    [ageGroup]
  );
}

// Ringkasan terstruktur: model tidak diminta menghitung dari ratusan baris.
export function ringkasLaporan(laporan: Array<Record<string, unknown>>, aktivitas: Array<Record<string, unknown>>) {
  const perAspek: Record<string, string[]> = {};
  for (const a of aktivitas) {
    const tanggal = String(laporan.find((l) => l.id === a.report_id)?.report_date || "").slice(0, 10);
    const judul = String(a.title || "");
    if (!judul) continue;
    for (const aspek of ["Nilai Agama & Moral", "Motorik Kasar", "Motorik Halus", "Bahasa", "Kognitif", "Sosial Emosional", "Kemandirian"]) {
      const kata = aspek.toLowerCase().split(/\s+/)[0];
      if (judul.toLowerCase().includes(kata)) (perAspek[aspek] ||= []).push(`${tanggal}: ${judul}`);
    }
  }
  const rating = aktivitas.map((a) => Number(a.rating || 0)).filter((n) => n > 0);
  return {
    jumlah_laporan: laporan.length,
    periode: laporan.length
      ? `${String(laporan[0].report_date).slice(0, 10)}..${String(laporan[laporan.length - 1].report_date).slice(0, 10)}`
      : null,
    rata_rata_rating: rating.length ? Number((rating.reduce((a, b) => a + b, 0) / rating.length).toFixed(2)) : null,
    aktivitas_unik: [...new Set(aktivitas.map((a) => String(a.title || "")).filter(Boolean))].slice(0, 30),
    aktivitas_per_aspek: perAspek,
    mood: [...new Set(laporan.map((l) => String(l.mood || "")).filter(Boolean))],
    catatan_guru: laporan.map((l) => String(l.notes || "")).filter(Boolean).slice(0, 12),
  };
}
