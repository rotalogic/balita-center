import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const rows = await query(
      `SELECT c.id, c.full_name, c.nickname, c.birth_date, c.gender, c.status, c.photo_url,
              b.name AS branch_name,
              (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
                WHERE e.child_id = c.id AND e.status = 'aktif' ORDER BY e.start_date DESC LIMIT 1) AS class_name,
              (SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
                WHERE cg.child_id = c.id ORDER BY cg.is_primary DESC LIMIT 1) AS guardian_name
         FROM children c
         JOIN branches b ON b.id = c.branch_id
        WHERE c.deleted_at IS NULL AND ($1 = '' OR c.full_name ILIKE '%' || $1 || '%')
        ORDER BY c.full_name
        LIMIT 200`,
      [q]
    );
    return NextResponse.json({ ok: true, children: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const required = ["branch_id", "full_name", "class_id", "program_id"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ ok: false, error: `Kolom wajib belum diisi: ${field}` }, { status: 400 });
      }
    }
    const childRows = await query(
      `INSERT INTO children (branch_id, full_name, nickname, birth_date, gender, birth_place, religion,
                             blood_type, health_notes, special_needs, languages, hobbies,
                             transport_mode, photo_consent, enrolled_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        body.branch_id,
        body.full_name,
        body.nickname || null,
        body.birth_date || null,
        body.gender || null,
        body.birth_place || null,
        body.religion || null,
        body.blood_type || null,
        body.health_notes || null,
        body.special_needs || null,
        body.languages || null,
        body.hobbies || null,
        body.transport_mode || null,
        body.photo_consent === "true",
        body.enrolled_on || null,
      ]
    );
    const childId = (childRows[0] as { id: string }).id;

    if (body.guardian_name) {
      const guardianRows = await query(
        `INSERT INTO guardians (full_name, phone, email, relation, nik, occupation, employer, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          body.guardian_name,
          body.guardian_phone || null,
          body.guardian_email || null,
          body.guardian_relation || null,
          body.guardian_nik || null,
          body.guardian_occupation || null,
          body.guardian_employer || null,
          body.guardian_address || null,
        ]
      );
      await query("INSERT INTO child_guardians (child_id, guardian_id, is_primary) VALUES ($1,$2,TRUE)", [
        childId,
        (guardianRows[0] as { id: string }).id,
      ]);
    }

    await query(
      `INSERT INTO enrollments (branch_id, child_id, class_id, program_id, start_date, status)
       VALUES ($1,$2,$3,$4, COALESCE($5::date, CURRENT_DATE), 'aktif')`,
      [body.branch_id, childId, body.class_id, body.program_id, body.enrolled_on || null]
    );

    return NextResponse.json({ ok: true, id: childId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
