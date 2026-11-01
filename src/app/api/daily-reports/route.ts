import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "").trim();
    const rows = await query(
      `SELECT r.id, r.report_date, r.status, r.mood, r.meal_level, r.snack_level, r.nap_quality,
              r.toilet_pee_count, r.toilet_poop_count, r.notes,
              c.full_name AS child_name, cl.name AS class_name,
              s.full_name AS teacher_name, lf.full_name AS facilitator_name,
              (SELECT COUNT(*) FROM daily_report_photos p WHERE p.report_id = r.id) AS photo_count,
              (SELECT COUNT(*) FROM daily_report_activities a WHERE a.report_id = r.id) AS activity_count
         FROM daily_reports r
         JOIN children c ON c.id = r.child_id
         JOIN classes cl ON cl.id = r.class_id
         JOIN staff s ON s.id = r.created_by
         LEFT JOIN staff lf ON lf.id = r.lead_facilitator_id
        WHERE ($1 = '' OR r.status = $1)
        ORDER BY r.report_date DESC, c.full_name
        LIMIT 200`,
      [status]
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
};

export async function POST(request: Request) {
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
      submit?: boolean;
      activities?: ActivityInput[];
      photo_urls?: string[];
    };
    if (!body.branch_id || !body.child_id || !body.class_id || !body.created_by || !body.report_date) {
      return NextResponse.json(
        { ok: false, error: "Cabang, anak, kelas, guru pembuat, dan tanggal laporan wajib diisi." },
        { status: 400 }
      );
    }
    const rows = await query(
      `INSERT INTO daily_reports (branch_id, child_id, class_id, report_date, lead_facilitator_id,
                                  meals_text, snack_text, meal_level, snack_level, nap_quality,
                                  nap_start, nap_end, toilet_count, toilet_pee_count, toilet_poop_count,
                                  mood, mood_notes, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
        body.submit ? "menunggu_review" : "draft",
        body.created_by,
      ]
    );
    const reportId = (rows[0] as { id: string }).id;

    for (const [index, activity] of (body.activities || []).entries()) {
      if (!activity.title) continue;
      await query(
        `INSERT INTO daily_report_activities (report_id, activity_time, area, apparatus, title, rating, notes, photo_url, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          reportId,
          activity.activity_time || null,
          activity.area || null,
          activity.apparatus || null,
          activity.title,
          activity.rating || null,
          activity.notes || null,
          activity.photo_url || null,
          index,
        ]
      );
    }
    for (const url of body.photo_urls || []) {
      if (!url) continue;
      await query("INSERT INTO daily_report_photos (report_id, photo_url) VALUES ($1,$2)", [reportId, url]);
    }
    return NextResponse.json({ ok: true, id: reportId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
