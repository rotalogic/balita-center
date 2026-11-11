import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard, hasPermission } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const child = await query("SELECT * FROM children WHERE id = $1 AND deleted_at IS NULL", [params.id]);
    if (child.length === 0) {
      return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });
    }
    const [guardians, enrollment, reports, health, development, milestones, observations] = await Promise.all([
      query(
        `SELECT g.* FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
          WHERE cg.child_id = $1 ORDER BY cg.is_primary DESC`,
        [params.id]
      ),
      query(
        `SELECT e.*, c.name AS class_name, p.name AS program_name FROM enrollments e
           JOIN classes c ON c.id = e.class_id JOIN programs p ON p.id = e.program_id
          WHERE e.child_id = $1 ORDER BY e.start_date DESC LIMIT 1`,
        [params.id]
      ),
      query("SELECT id, report_date, status, mood FROM daily_reports WHERE child_id = $1 AND deleted_at IS NULL ORDER BY report_date DESC LIMIT 5", [params.id]),
      query("SELECT * FROM health_checks WHERE child_id = $1 ORDER BY checked_on DESC LIMIT 5", [params.id]),
      query("SELECT * FROM child_development_records WHERE child_id = $1 ORDER BY recorded_on DESC LIMIT 3", [params.id]),
      query("SELECT * FROM student_milestones WHERE child_id = $1 ORDER BY achieved_on DESC LIMIT 10", [params.id]),
      query(
        `SELECT mo.id, mo.observed_on, mo.level, m.indikator, m.age_group, m.aspect
           FROM milestone_observations mo JOIN milestones m ON m.id = mo.milestone_id
          WHERE mo.child_id = $1 ORDER BY mo.observed_on DESC, mo.created_at DESC LIMIT 10`,
        [params.id]
      ),
    ]);
    return NextResponse.json({ ok: true, child: child[0], guardians, enrollment: enrollment[0] || null, reports, health, development, milestones, observations });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Ubah data anak (bukan hapus). Tercatat di Jejak Audit.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("students.update");
  if (denied.error) return denied.error;
  if (!hasPermission(denied.user, "students.update")) {
    return NextResponse.json({ ok: false, error: "Anda tidak berhak mengubah data anak." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, string>;
    const boleh: Record<string, string> = {
      full_name: "full_name", nickname: "nickname", birth_date: "birth_date", gender: "gender",
      blood_type: "blood_type", status: "status", health_notes: "health_notes",
      special_needs: "special_needs", languages: "languages", hobbies: "hobbies",
      transport_mode: "transport_mode", photo_url: "photo_url", tautan_folder_dokumentasi: "tautan_folder_dokumentasi",
      kategori_program: "kategori_program", label_status: "label_status",
    };
    if ("kategori_program" in body && !["ZKC", "SAM"].includes(body.kategori_program)) {
      return NextResponse.json({ ok: false, error: "Kategori program harus ZKC atau SAM." }, { status: 400 });
    }
    if ("tautan_folder_dokumentasi" in body && (body.tautan_folder_dokumentasi || "").trim() !== "" && !/^https?:\/\//i.test((body.tautan_folder_dokumentasi || "").trim())) {
      return NextResponse.json({ ok: false, error: "Tautan folder dokumentasi harus diawali http:// atau https://." }, { status: 400 });
    }
    if ("label_status" in body && !["Anggota", "Trial", "Insidentil", "Peserta Event", "Klien Skrining", "Klien Konsultasi"].includes(body.label_status)) {
      return NextResponse.json({ ok: false, error: "Label status anak tidak dikenal." }, { status: 400 });
    }
    const set: string[] = [];
    const nilai: unknown[] = [];
    const perubahan: Record<string, { dari: unknown; ke: unknown }> = {};

    const lama = await query<Record<string, unknown>>("SELECT * FROM children WHERE id = $1::uuid", [params.id]);
    if (!lama[0]) return NextResponse.json({ ok: false, error: "Anak tidak ditemukan." }, { status: 404 });

    for (const [kunci, kolom] of Object.entries(boleh)) {
      if (!(kunci in body)) continue;
      const baru = (body[kunci] || "").trim() || null;
      const sebelumnya = lama[0][kolom] ?? null;
      if (String(sebelumnya ?? "") === String(baru ?? "")) continue;
      nilai.push(baru);
      set.push(`${kolom} = $${nilai.length}`);
      perubahan[kolom] = { dari: sebelumnya, ke: baru };
    }

    if (set.length === 0) return NextResponse.json({ ok: true, berubah: 0 });

    nilai.push(params.id);
    await query(`UPDATE children SET ${set.join(", ")}, updated_at = now() WHERE id = $${nilai.length}::uuid`, nilai);

    await catatAudit(denied.user, {
      action: "child.update",
      entityTable: "children",
      entityId: params.id,
      branchId: (lama[0].branch_id as string) || null,
      detail: { anak: lama[0].full_name, perubahan },
    });
    return NextResponse.json({ ok: true, berubah: Object.keys(perubahan).length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
