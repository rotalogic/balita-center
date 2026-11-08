import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard, hasPermission } from "@/lib/current-user";
import { cekSyaratTerbit } from "@/lib/syarat-terbit";
import { beda, catatAudit } from "@/lib/audit";
import { notifLaporanTerbit } from "@/lib/ailsa/notify";
import { emailLaporanTerbitWali } from "@/lib/beritahu-wali";

export const dynamic = "force-dynamic";

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

type PatchBody = {
  publish?: boolean;
  status?: string;
  lead_facilitator_id?: string;
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
  report_date?: string;
  submit?: boolean;
  restore?: boolean;
  activities?: ActivityInput[];
  photo_urls?: string[];
  photos?: Array<{ photo_url: string; media_type?: string; mime_type?: string; poster_url?: string; caption?: string }>;
};

const EDITABLE = ["draft", "revisi"];

const KOLOM_AUDIT = [
  "report_date", "lead_facilitator_id", "meals_text", "snack_text", "meal_level",
  "snack_level", "nap_quality", "nap_start", "nap_end", "mood", "mood_notes", "notes",
];

function pesanError(error: unknown): string {
  // Kode 23505 = duplicate key; jangan bocorkan nama constraint ke pengguna.
  const kode = (error as { code?: string } | null)?.code;
  if (kode === "23505") return "Sudah ada laporan untuk anak ini pada tanggal tersebut.";
  return dbErrorMessage(error);
}

// Detail satu laporan harian beserta aktivitas dan medianya.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const report = await query(
      `SELECT r.*, c.full_name AS child_name, cl.name AS class_name,
              s.full_name AS teacher_name, s.photo_url AS teacher_photo, s.signature_url AS teacher_ttd, lf.full_name AS facilitator_name,
              du.full_name AS deleted_by_name
         FROM daily_reports r
         JOIN children c ON c.id = r.child_id
         JOIN classes cl ON cl.id = r.class_id
         JOIN staff s ON s.id = r.created_by
         LEFT JOIN staff lf ON lf.id = r.lead_facilitator_id
         LEFT JOIN users du ON du.id = r.deleted_by
        WHERE r.id = $1`,
      [params.id]
    );
    if (report.length === 0) {
      return NextResponse.json({ ok: false, error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    const [activities, photos, riwayat] = await Promise.all([
      query("SELECT * FROM daily_report_activities WHERE report_id = $1 ORDER BY sort_order", [params.id]),
      query("SELECT * FROM daily_report_photos WHERE report_id = $1 ORDER BY created_at", [params.id]),
      query(
        `SELECT a.action, a.detail, a.created_at, u.full_name AS oleh
           FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.entity_table = 'daily_reports' AND a.entity_id = $1
          ORDER BY a.created_at DESC LIMIT 20`,
        [params.id]
      ),
    ]);
    return NextResponse.json({ ok: true, report: report[0], activities, photos, riwayat });
  } catch (error) {
    return NextResponse.json({ ok: false, error: pesanError(error) }, { status: 503 });
  }
}

// Simpan perubahan draft/revisi, kirim untuk review, atau pulihkan laporan terhapus.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as PatchBody;

    const current = await query<Record<string, unknown> & { status: string; branch_id: string; deleted_at: string | null }>(
      "SELECT * FROM daily_reports WHERE id = $1",
      [params.id]
    );
    if (current.length === 0) {
      return NextResponse.json({ ok: false, error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    const sebelum = current[0];

    // Pulihkan laporan yang di-soft-delete. Hanya Super Admin / pemegang izin
    // hapus-laporan yang boleh, dan hanya bila anak+tanggal itu belum dipakai
    // laporan aktif lain (kalau tidak, unique index akan menolaknya).
    if (body.restore) {
      if (!sebelum.deleted_at) {
        return NextResponse.json({ ok: false, error: "Laporan ini tidak sedang terhapus." }, { status: 409 });
      }
      if (!hasPermission(denied.user, "users.manage") && !denied.user.roles.includes("super_admin")) {
        return NextResponse.json({ ok: false, error: "Hanya Super Admin yang bisa memulihkan laporan." }, { status: 403 });
      }
      await query("UPDATE daily_reports SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = $1", [params.id]);
      await catatAudit(denied.user, {
        action: "daily_report.restore",
        entityTable: "daily_reports",
        entityId: params.id,
        branchId: sebelum.branch_id,
        detail: { status: sebelum.status },
      });
      return NextResponse.json({ ok: true, status: sebelum.status });
    }

    if (sebelum.deleted_at) {
      return NextResponse.json({ ok: false, error: "Laporan ini sudah dihapus. Pulihkan dulu sebelum diubah." }, { status: 409 });
    }
    // Terbitkan: hanya dari menunggu_review, wajib lolos Syarat Terbit, dan
    // wajib punya izin terbit. Sebelumnya endpoint ini diam saja saat menerima
    // status:"published" — laporan tampak "terbit" di layar padahal tidak.
    if (body.publish || body.status === "published") {
      if (!hasPermission(denied.user, "daily_reports.publish")) {
        return NextResponse.json({ ok: false, error: "Anda tidak punya izin menerbitkan laporan." }, { status: 403 });
      }
      if (sebelum.status === "published") {
        return NextResponse.json({ ok: false, error: "Laporan ini sudah terbit." }, { status: 409 });
      }
      const cek = await cekSyaratTerbit(params.id);
      if (!cek.ok) {
        return NextResponse.json(
          { ok: false, error: "Syarat terbit belum lengkap.", kurang: cek.kurang },
          { status: 422 }
        );
      }
      await query(
        "UPDATE daily_reports SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now() WHERE id = $1",
        [params.id]
      );
      void notifLaporanTerbit(params.id).catch((e) => console.error("[NOTIF]", (e as Error)?.message));
      void emailLaporanTerbitWali(params.id).catch((e) => console.error("[EMAIL-TERBIT]", (e as Error)?.message));
      await catatAudit(denied.user, {
        action: "daily_report.publish",
        entityTable: "daily_reports",
        entityId: params.id,
        branchId: sebelum.branch_id,
        detail: { dari: sebelum.status, ke: "published" },
      });
      return NextResponse.json({ ok: true, status: "published" });
    }

    if (body.status !== undefined && body.status !== sebelum.status) {
      return NextResponse.json(
        { ok: false, error: "Status hanya bisa diubah lewat kirim (submit) atau terbitkan (publish)." },
        { status: 400 }
      );
    }

    if (!EDITABLE.includes(sebelum.status)) {
      return NextResponse.json(
        { ok: false, error: `Laporan berstatus "${sebelum.status}" tidak bisa diedit.` },
        { status: 409 }
      );
    }

    // Update parsial: hanya kolom yang dikirim yang diubah (submit-only tidak mengosongkan isi).
    const values: unknown[] = [params.id];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if ("lead_facilitator_id" in body) add("lead_facilitator_id", body.lead_facilitator_id || null);
    if ("meals_text" in body) add("meals_text", body.meals_text || null);
    if ("snack_text" in body) add("snack_text", body.snack_text || null);
    if ("meal_level" in body) add("meal_level", body.meal_level || null);
    if ("snack_level" in body) add("snack_level", body.snack_level || null);
    if ("nap_quality" in body) add("nap_quality", body.nap_quality || null);
    if ("nap_start" in body) add("nap_start", body.nap_start || null);
    if ("nap_end" in body) add("nap_end", body.nap_end || null);
    if ("mood" in body) add("mood", body.mood || null);
    if ("mood_notes" in body) add("mood_notes", body.mood_notes || null);
    if ("notes" in body) add("notes", body.notes || null);
    if ("circle_theme" in body) add("circle_theme", body.circle_theme || null);
    if ("circle_rating" in body) add("circle_rating", body.circle_rating ? Number(body.circle_rating) : null);
    if ("circle_notes" in body) add("circle_notes", body.circle_notes || null);
    if ("special_moment" in body) add("special_moment", body.special_moment || null);
    if ("home_suggestion" in body) add("home_suggestion", body.home_suggestion || null);
    if ("report_date" in body && body.report_date) add("report_date", body.report_date);
    if ("toilet_pee_count" in body || "toilet_poop_count" in body) {
      const pee = Number(body.toilet_pee_count || 0);
      const poop = Number(body.toilet_poop_count || 0);
      add("toilet_pee_count", pee);
      add("toilet_poop_count", poop);
      add("toilet_count", pee + poop);
    }

    if (sets.length > 0) {
      await query(`UPDATE daily_reports SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
    }

    if (Array.isArray(body.activities)) {
      await query("DELETE FROM daily_report_activities WHERE report_id = $1", [params.id]);
      for (const [index, activity] of body.activities.entries()) {
        if (!activity.title) continue;
        await query(
          `INSERT INTO daily_report_activities (report_id, activity_time, area, apparatus, title, rating, notes, photo_url, sort_order,
                                                material_id, work_location, work_mode, milestone_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$11,$12,$13::uuid)`,
          [
            params.id,
            activity.activity_time || null,
            activity.area || null,
            activity.apparatus || null,
            activity.title,
            activity.rating || null,
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
      // Samakan riwayat observasi milestone dengan isi aktivitas terbaru.
      await query("DELETE FROM milestone_observations WHERE report_id = $1", [params.id]);
      const tanggalObs = String(body.report_date || sebelum.report_date || "").slice(0, 10);
      for (const activity of body.activities) {
        if (!activity.title || !activity.milestone_id || !tanggalObs) continue;
        await query(
          `INSERT INTO milestone_observations (child_id, milestone_id, observed_on, level, report_id, material_id, created_by)
           VALUES ($1,$2::uuid,$3,$4,$5,$6::uuid,$7::uuid)`,
          [sebelum.child_id, activity.milestone_id, tanggalObs, activity.rating || null, params.id, activity.material_id || null, sebelum.created_by || null]
        );
      }
    }

    if (Array.isArray(body.photos)) {
      await query("DELETE FROM daily_report_photos WHERE report_id = $1", [params.id]);
      for (const p of body.photos) {
        if (!p.photo_url) continue;
        await query(
          "INSERT INTO daily_report_photos (report_id, photo_url, media_type, mime_type, poster_url, caption) VALUES ($1,$2,$3,$4,$5,$6)",
          [params.id, p.photo_url, p.media_type === "video" ? "video" : "image", p.mime_type || null, p.poster_url || null, p.caption || null]
        );
      }
    } else if (Array.isArray(body.photo_urls)) {
      await query("DELETE FROM daily_report_photos WHERE report_id = $1", [params.id]);
      for (const url of body.photo_urls) {
        if (!url) continue;
        await query("INSERT INTO daily_report_photos (report_id, photo_url) VALUES ($1,$2)", [params.id, url]);
      }
    }

    // Selalu catat perubahan isi penting (field: dari → ke).
    const sesudah = { ...sebelum };
    for (let i = 1; i < values.length; i += 1) {
      const kolom = sets[i - 1].split(" = ")[0];
      sesudah[kolom] = values[i];
    }
    const perubahan = beda(sebelum, sesudah, KOLOM_AUDIT);

    if (body.submit) {
      const cek = await cekSyaratTerbit(params.id);
      if (!cek.ok) {
        // Draft TETAP tersimpan. Klien diberi daftar kekurangan yang spesifik.
        if (Object.keys(perubahan).length > 0) {
          await catatAudit(denied.user, {
            action: "daily_report.edit",
            entityTable: "daily_reports",
            entityId: params.id,
            branchId: sebelum.branch_id,
            detail: { perubahan },
          });
        }
        return NextResponse.json(
          { ok: false, error: "Laporan tersimpan sebagai draft, tetapi belum bisa dikirim.", kurang: cek.kurang },
          { status: 422 }
        );
      }
      await query("UPDATE daily_reports SET status = 'menunggu_review', updated_at = now() WHERE id = $1", [params.id]);
      await catatAudit(denied.user, {
        action: "daily_report.submit",
        entityTable: "daily_reports",
        entityId: params.id,
        branchId: sebelum.branch_id,
        detail: { dari: sebelum.status, ke: "menunggu_review", perubahan },
      });
      return NextResponse.json({ ok: true, status: "menunggu_review" });
    }

    if (Object.keys(perubahan).length > 0) {
      await catatAudit(denied.user, {
        action: "daily_report.edit",
        entityTable: "daily_reports",
        entityId: params.id,
        branchId: sebelum.branch_id,
        detail: { perubahan },
      });
    }
    return NextResponse.json({ ok: true, status: sebelum.status });
  } catch (error) {
    const kode = (error as { code?: string } | null)?.code;
    return NextResponse.json({ ok: false, error: pesanError(error) }, { status: kode === "23505" ? 409 : 500 });
  }
}

// Soft delete: laporan tidak pernah benar-benar dihapus dari database.
// deleted_at + deleted_by diisi, isi laporan tetap utuh dan bisa dipulihkan.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const current = await query<{ status: string; branch_id: string; deleted_at: string | null; child_name: string }>(
      `SELECT r.status, r.branch_id, r.deleted_at, c.full_name AS child_name
         FROM daily_reports r JOIN children c ON c.id = r.child_id
        WHERE r.id = $1`,
      [params.id]
    );
    if (current.length === 0) {
      return NextResponse.json({ ok: false, error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    if (current[0].deleted_at) {
      return NextResponse.json({ ok: false, error: "Laporan ini sudah dihapus." }, { status: 409 });
    }
    if (current[0].status !== "draft") {
      return NextResponse.json(
        { ok: false, error: `Hanya draft yang bisa dihapus. Status sekarang "${current[0].status}".` },
        { status: 409 }
      );
    }
    await query("UPDATE daily_reports SET deleted_at = now(), deleted_by = $2 WHERE id = $1", [params.id, denied.user.id]);
    await catatAudit(denied.user, {
      action: "daily_report.delete",
      entityTable: "daily_reports",
      entityId: params.id,
      branchId: current[0].branch_id,
      detail: { anak: current[0].child_name, status: current[0].status },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: pesanError(error) }, { status: 500 });
  }
}
