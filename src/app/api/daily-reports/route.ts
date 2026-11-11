import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { cekSyaratTerbit } from "@/lib/syarat-terbit";
import { catatAudit } from "@/lib/audit";
import { SEGMEN_ZKC } from "@/lib/segmen";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "").trim();
    const scope = branchScope(denied.user);
    // Sertakan laporan yang sudah di-soft-delete HANYA bila diminta eksplisit
    // (?sampah=1). Mode normal tidak pernah menampilkannya.
    const sampah = searchParams.get("sampah") === "1";
    const rows = await query(
      `SELECT r.id, r.report_date, r.status, r.mood, r.meal_level, r.snack_level, r.nap_quality,
              r.toilet_pee_count, r.toilet_poop_count, r.notes,
              r.deleted_at, r.deleted_by, du.full_name AS deleted_by_name,
              c.full_name AS child_name, cl.name AS class_name,
              s.full_name AS teacher_name, lf.full_name AS facilitator_name,
              (SELECT COUNT(*) FROM daily_report_photos p WHERE p.report_id = r.id) AS photo_count,
              (SELECT COUNT(*) FROM daily_report_activities a WHERE a.report_id = r.id) AS activity_count
         FROM daily_reports r
         JOIN children c ON c.id = r.child_id
         JOIN classes cl ON cl.id = r.class_id
         JOIN staff s ON s.id = r.created_by
         LEFT JOIN staff lf ON lf.id = r.lead_facilitator_id
         LEFT JOIN users du ON du.id = r.deleted_by
        WHERE ($1 = '' OR r.status = $1)
          AND ($2::uuid[] IS NULL OR r.branch_id = ANY($2::uuid[]))
          AND (($3 AND r.deleted_at IS NOT NULL) OR (NOT $3 AND r.deleted_at IS NULL))
        ORDER BY r.report_date DESC, c.full_name
        LIMIT 200`,
      [status, scope, sampah]
    );
    return NextResponse.json({ ok: true, reports: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

type ActivityInput = {
  title: string;
  apparatus?: string;
  area?: string;
  rating?: number;
  photo_url?: string;
  activity_time?: string;
  notes?: string;
  material_id?: string | null;
  work_location?: string | null;
  work_mode?: string | null;
  milestone_id?: string | null;
};

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      branch_id: string;
      child_id: string;
      class_id: string;
      created_by: string;
      lead_facilitator_id?: string;
      report_date: string;
      meals_text?: string;
      snack_text?: string;
      meal_level?: string;
      snack_level?: string;
      nap_quality?: string;
      nap_start?: string;
      nap_end?: string;
      toilet_pee_count?: number;
      toilet_poop_count?: number;
      mood?: string;
      mood_notes?: string;
      notes?: string;
      circle_theme?: string;
      circle_rating?: number;
      circle_notes?: string;
      special_moment?: string;
      home_suggestion?: string;
      submit?: boolean;
      activities?: ActivityInput[];
      photo_urls?: string[];
      photos?: Array<{ photo_url: string; media_type?: string; mime_type?: string; poster_url?: string; caption?: string }>;
      segmen?: Record<string, string>;
    };

    // Anak yang tercatat tidak hadir (izin/sakit/alpa) tidak dibuatkan laporan
    // hari itu — kaidah Modul Laporan Harian.
    const presensi = await query<{ status: string }>(
      "SELECT status FROM child_attendance WHERE child_id = $1 AND att_date = $2",
      [body.child_id, body.report_date]
    );
    if (presensi.length > 0 && presensi[0].status !== "hadir") {
      return NextResponse.json(
        {
          ok: false,
          error: `Anak tercatat ${presensi[0].status} pada tanggal laporan — laporan harian tidak dibuat untuk anak yang tidak hadir.`,
        },
        { status: 422 }
      );
    }

    const duplikat = await query<{ id: string; child_name: string }>(
      `SELECT r.id, c.full_name AS child_name
         FROM daily_reports r JOIN children c ON c.id = r.child_id
        WHERE r.child_id = $1 AND r.report_date = $2 AND r.deleted_at IS NULL`,
      [body.child_id, body.report_date]
    );
    if (duplikat.length > 0) {
      const tanggal = new Date(body.report_date).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      });
      return NextResponse.json(
        {
          ok: false,
          error: `Sudah ada laporan untuk ${duplikat[0].child_name} pada ${tanggal}.`,
          existing_id: duplikat[0].id,
        },
        { status: 409 }
      );
    }

    const rows = await query(
      `INSERT INTO daily_reports (branch_id, child_id, class_id, report_date, lead_facilitator_id,
                                  meals_text, snack_text, meal_level, snack_level, nap_quality,
                                  nap_start, nap_end, toilet_count, toilet_pee_count, toilet_poop_count,
                                  mood, mood_notes, notes, circle_theme, circle_rating, circle_notes,
                                  special_moment, home_suggestion, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING id`,
      [
        body.branch_id,
        body.child_id,
        body.class_id,
        body.report_date,
        body.lead_facilitator_id || null,
        body.meals_text || null,
        body.snack_text || null,
        body.meal_level || null,
        body.snack_level || null,
        body.nap_quality || null,
        body.nap_start || null,
        body.nap_end || null,
        Number(body.toilet_pee_count || 0) + Number(body.toilet_poop_count || 0),
        Number(body.toilet_pee_count || 0),
        Number(body.toilet_poop_count || 0),
        body.mood || null,
        body.mood_notes || null,
        body.notes || null,
        body.circle_theme || null,
        body.circle_rating ? Math.max(1, Math.min(3, Number(body.circle_rating))) : null,
        body.circle_notes || null,
        body.special_moment || null,
        body.home_suggestion || null,
        "draft",
        body.created_by,
      ]
    );
    const reportId = (rows[0] as { id: string }).id;

    for (const [index, activity] of (body.activities || []).entries()) {
      if (!activity.title) continue;
      await query(
        `INSERT INTO daily_report_activities
           (report_id, activity_time, area, apparatus, title, rating, notes, photo_url, sort_order,
            material_id, work_location, work_mode, milestone_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$11,$12,$13::uuid)`,
        [
          reportId,
          activity.activity_time || null,
          activity.area || null,
          activity.apparatus || null,
          activity.title,
          activity.rating ? Math.max(1, Math.min(3, Number(activity.rating))) : null,
          activity.notes || null,
          activity.photo_url || null,
          index,
          activity.material_id || null,
          activity.work_location || null,
          activity.work_mode || null,
          activity.milestone_id || null,
        ]
      );
    }
    // Aktivitas yang memilih milestone ikut tercatat sebagai observasi
    // perkembangan anak (penilaian kata = tingkat capaian).
    for (const activity of body.activities || []) {
      if (!activity.title || !activity.milestone_id) continue;
      await query(
        `INSERT INTO milestone_observations (child_id, milestone_id, observed_on, level, report_id, material_id, created_by)
         VALUES ($1,$2::uuid,$3,$4,$5,$6::uuid,$7::uuid)`,
        [body.child_id, activity.milestone_id, body.report_date, activity.rating ? Math.max(1, Math.min(3, Number(activity.rating))) : null, reportId, activity.material_id || null, body.created_by || null]
      );
    }
    if (Array.isArray(body.photos)) {
      for (const p of body.photos) {
        if (!p.photo_url) continue;
        await query(
          "INSERT INTO daily_report_photos (report_id, photo_url, media_type, mime_type, poster_url, caption) VALUES ($1,$2,$3,$4,$5,$6)",
          [reportId, p.photo_url, p.media_type === "video" ? "video" : "image", p.mime_type || null, p.poster_url || null, p.caption || null]
        );
      }
    } else {
      for (const url of body.photo_urls || []) {
        if (!url) continue;
        await query("INSERT INTO daily_report_photos (report_id, photo_url) VALUES ($1,$2)", [reportId, url]);
      }
    }

    // Segmen sesi resmi ZKC (9 segmen) yang terisi pada laporan ini.
    if (body.segmen) {
      for (const s of SEGMEN_ZKC) {
        const catatan = String(body.segmen[s.kunci] || "").trim();
        if (!catatan) continue;
        await query(
          "INSERT INTO daily_report_segments (report_id, segmen, catatan) VALUES ($1,$2,$3) ON CONFLICT (report_id, segmen) DO UPDATE SET catatan = EXCLUDED.catatan",
          [reportId, s.kunci, catatan]
        );
      }
    }

    // Laporan baru selalu dibuat sebagai draft dulu, lalu — bila diminta —
    // diperiksa Syarat Terbit dan dikirim. Bila syarat kurang, draft TETAP
    // tersimpan dan klien menerima daftar kekurangan (422), bukan sukses palsu.
    let status = "draft";
    let kurang: string[] = [];
    if (body.submit) {
      const cek = await cekSyaratTerbit(reportId);
      if (cek.ok) {
        await query("UPDATE daily_reports SET status = 'menunggu_review', updated_at = now() WHERE id = $1", [reportId]);
        status = "menunggu_review";
      } else {
        kurang = cek.kurang;
      }
    }

    await catatAudit(denied.user, {
      action: status === "menunggu_review" ? "daily_report.submit" : "daily_report.create",
      entityTable: "daily_reports",
      entityId: reportId,
      branchId: body.branch_id,
      detail: { tanggal: body.report_date, anak: body.child_id, status },
    });

    return NextResponse.json({ ok: true, id: reportId, status, kurang }, { status: kurang.length ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
