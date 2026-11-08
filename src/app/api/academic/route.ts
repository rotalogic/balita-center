import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { branchScope, guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { ASPEK_STPPA, aspekDari, labelAspek } from "@/lib/stppa";

export const dynamic = "force-dynamic";

const KELOMPOK_USIA = ["0-1 tahun", "1-2 tahun", "2-3 tahun", "3-4 tahun", "4-5 tahun", "5-6 tahun"];

export async function GET() {
  const denied = await guard("students.view");
  if (denied.error) return denied.error;
  try {
    const scope = branchScope(denied.user);
    const [cycles, stppa, classes, branches, materials, milestones, materialMilestones, events] = await Promise.all([
      query(
        `SELECT c.*, b.name AS branch_name, k.name AS class_name,
                (SELECT count(*)::int FROM cycle_reports cr WHERE cr.cycle_id = c.id) AS report_count
           FROM learning_cycles c
           JOIN branches b ON b.id = c.branch_id
           JOIN classes k ON k.id = c.class_id
          WHERE ($1::uuid[] IS NULL OR c.branch_id = ANY($1::uuid[]))
          ORDER BY c.start_date DESC LIMIT 200`,
        [scope]
      ),
      query(`SELECT * FROM stppa_items ORDER BY age_group, aspect, sort_order, item_text LIMIT 1000`),
      query("SELECT id, name, branch_id FROM classes ORDER BY name"),
      query("SELECT id, name FROM branches ORDER BY name"),
      query("SELECT * FROM materials ORDER BY area, name LIMIT 500"),
      query("SELECT * FROM milestones ORDER BY age_group, indikator LIMIT 500"),
      query("SELECT material_id, milestone_id FROM material_milestones"),
      query(
        `SELECT e.*, b.name AS branch_name, k.name AS class_name
           FROM school_events e
           JOIN branches b ON b.id = e.branch_id
           LEFT JOIN classes k ON k.id = e.class_id
          WHERE ($1::uuid[] IS NULL OR e.branch_id = ANY($1::uuid[]))
          ORDER BY e.event_date DESC LIMIT 200`,
        [scope]
      ),
    ]);
    return NextResponse.json({
      ok: true,
      cycles,
      stppa: (stppa as Array<Record<string, unknown>>).map((r) => ({ ...r, aspect_label: labelAspek(String(r.aspect)) })),
      classes,
      branches,
      aspects: ASPEK_STPPA,
      ageGroups: KELOMPOK_USIA,
      materials,
      milestones,
      materialMilestones,
      events,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

type Body = {
  kind?: string;
  branch_id?: string;
  class_id?: string;
  theme?: string;
  start_date?: string;
  end_date?: string;
  age_group?: string;
  aspect?: string;
  item_text?: string;
  sort_order?: number | string;
  csv?: string;
  id?: string;
  name?: string;
  name_en?: string;
  area?: string;
  is_active?: boolean;
  indikator?: string;
  montessori_area?: string;
  status?: string;
  material_id?: string;
  milestone_id?: string;
  title?: string;
  event_date?: string;
  category?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  is_holiday?: boolean;
  description?: string;
};

const AREA_MATERIAL = ["practical_life", "language", "sensorial", "mathematics", "cultural", "observasi"];
const USIA_MILESTONE = ["0-<1", "1-<2", "2-<3", "3-<4", "4-<5", "5-6"];
const ASPEK_MILESTONE = ["nilai_agama_moral", "fisik_motorik", "kognitif", "bahasa", "sosial_emosional", "seni"];

export async function POST(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;

    if (body.kind === "cycle") {
      const tema = (body.theme || "").trim();
      if (!body.branch_id || !body.class_id) {
        return NextResponse.json({ ok: false, error: "Cabang dan kelas wajib dipilih." }, { status: 400 });
      }
      if (tema.length < 3) {
        return NextResponse.json({ ok: false, error: "Tema siklus minimal 3 karakter." }, { status: 400 });
      }
      if (!body.start_date || !body.end_date) {
        return NextResponse.json({ ok: false, error: "Tanggal mulai dan selesai wajib diisi." }, { status: 400 });
      }
      if (body.end_date < body.start_date) {
        return NextResponse.json(
          { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." },
          { status: 400 }
        );
      }
      const rows = await query<{ id: string }>(
        `INSERT INTO learning_cycles (branch_id, class_id, theme, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [body.branch_id, body.class_id, tema, body.start_date, body.end_date]
      );
      await catatAudit(denied.user, {
        action: "cycle.create",
        entityTable: "learning_cycles",
        entityId: rows[0].id,
        branchId: body.branch_id,
        detail: { tema, mulai: body.start_date, selesai: body.end_date },
      });
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    // Impor CSV: Kelompok Usia;Aspek;Butir  (pemisah ; atau , atau tab)
    if (body.kind === "stppa_import") {
      const teks = (body.csv || "").trim();
      if (!teks) {
        return NextResponse.json({ ok: false, error: "Isi CSV masih kosong." }, { status: 400 });
      }
      const baris = teks.split(/\r?\n/).filter((l) => l.trim());
      const gagal: Array<{ baris: number; alasan: string; isi: string }> = [];
      let masuk = 0;
      let duplikat = 0;

      for (let i = 0; i < baris.length; i++) {
        const isi = baris[i];
        const kolom = isi.split(/[;\t]|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((k) => k.trim().replace(/^"|"$/g, ""));
        // Lewati baris judul.
        if (i === 0 && /usia|aspek|butir/i.test(isi)) continue;
        if (kolom.length < 3) {
          gagal.push({ baris: i + 1, alasan: "Butuh 3 kolom: Kelompok Usia; Aspek; Butir.", isi });
          continue;
        }
        const usia = kolom[0];
        const aspek = aspekDari(kolom[1]);
        const butir = kolom.slice(2).join(",").trim();
        if (!KELOMPOK_USIA.includes(usia)) {
          gagal.push({ baris: i + 1, alasan: `Kelompok usia "${usia}" tidak dikenal (pakai: ${KELOMPOK_USIA.join(", ")}).`, isi });
          continue;
        }
        if (!aspek) {
          gagal.push({ baris: i + 1, alasan: `Aspek "${kolom[1]}" tidak dikenal (pakai: ${ASPEK_STPPA.map((a) => a.label).join(", ")}).`, isi });
          continue;
        }
        if (butir.length < 5) {
          gagal.push({ baris: i + 1, alasan: "Butir minimal 5 karakter.", isi });
          continue;
        }
        const hasil = await query<{ id: string }>(
          `INSERT INTO stppa_items (age_group, aspect, item_text, sort_order)
           VALUES ($1,$2,$3,0)
           ON CONFLICT DO NOTHING RETURNING id`,
          [usia, aspek, butir]
        );
        if (hasil.length > 0) masuk++;
        else duplikat++;
      }

      await catatAudit(denied.user, {
        action: "stppa.import",
        entityTable: "stppa_items",
        detail: { masuk, duplikat, gagal: gagal.length },
      });
      return NextResponse.json({ ok: true, masuk, duplikat, gagal });
    }

    if (body.kind === "stppa") {
      const teks = (body.item_text || "").trim();
      const usia = (body.age_group || "").trim();
      const aspek = aspekDari(body.aspect || "");
      if (teks.length < 5) {
        return NextResponse.json({ ok: false, error: "Butir STPPA minimal 5 karakter." }, { status: 400 });
      }
      if (!usia) {
        return NextResponse.json({ ok: false, error: "Kelompok usia wajib dipilih." }, { status: 400 });
      }
      if (!KELOMPOK_USIA.includes(usia)) {
        return NextResponse.json(
          { ok: false, error: `Kelompok usia harus salah satu: ${KELOMPOK_USIA.join(", ")}.` },
          { status: 400 }
        );
      }
      if (!aspek) {
        return NextResponse.json(
          { ok: false, error: `Aspek harus salah satu: ${ASPEK_STPPA.map((a) => a.label).join(", ")}.` },
          { status: 400 }
        );
      }
      const kembar = await query<{ id: string }>(
        `SELECT id FROM stppa_items WHERE age_group=$1 AND aspect=$2 AND lower(item_text)=lower($3)`,
        [usia, aspek, teks]
      );
      if (kembar.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Butir yang sama sudah ada di kelompok usia dan aspek itu.", existing_id: kembar[0].id },
          { status: 409 }
        );
      }
      const rows = await query<{ id: string }>(
        `INSERT INTO stppa_items (age_group, aspect, item_text, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [usia, aspek, teks, Number(body.sort_order) || 0]
      );
      await catatAudit(denied.user, {
        action: "stppa.create",
        entityTable: "stppa_items",
        entityId: rows[0].id,
        detail: { aspek: labelAspek(aspek), usia, butir: teks },
      });
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    // ---------- Katalog material Montessori AMI ----------
    if (body.kind === "material_create") {
      const nama = (body.name || "").trim();
      if (nama.length < 2) return NextResponse.json({ ok: false, error: "Nama material minimal 2 karakter." }, { status: 400 });
      if (!body.area || !AREA_MATERIAL.includes(body.area)) {
        return NextResponse.json({ ok: false, error: `Area harus salah satu: ${AREA_MATERIAL.join(", ")}.` }, { status: 400 });
      }
      if (body.age_group && !["0-3", "3-6"].includes(body.age_group)) {
        return NextResponse.json({ ok: false, error: "Kelompok usia material harus 0-3 atau 3-6." }, { status: 400 });
      }
      const kembar = await query<{ id: string }>("SELECT id FROM materials WHERE lower(btrim(name)) = lower($1)", [nama]);
      if (kembar.length > 0) return NextResponse.json({ ok: false, error: "Material dengan nama itu sudah ada di katalog." }, { status: 409 });
      const rows = await query<{ id: string }>(
        "INSERT INTO materials (name, name_en, area, age_group) VALUES ($1,$2,$3,$4) RETURNING id",
        [nama, body.name_en || null, body.area, body.age_group || null]
      );
      await catatAudit(denied.user, { action: "material.create", entityTable: "materials", entityId: rows[0].id, detail: { nama, area: body.area } });
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    if (body.kind === "material_toggle") {
      if (!body.id) return NextResponse.json({ ok: false, error: "id material wajib." }, { status: 400 });
      const rows = await query<{ id: string }>(
        "UPDATE materials SET is_active = $2 WHERE id = $1 RETURNING id",
        [body.id, body.is_active === true]
      );
      if (rows.length === 0) return NextResponse.json({ ok: false, error: "Material tidak ditemukan." }, { status: 404 });
      await catatAudit(denied.user, { action: "material.toggle", entityTable: "materials", entityId: body.id, detail: { is_active: body.is_active === true } });
      return NextResponse.json({ ok: true });
    }

    // ---------- Katalog milestone perkembangan ----------
    if (body.kind === "milestone_create") {
      const indikator = (body.indikator || "").trim();
      if (indikator.length < 5) return NextResponse.json({ ok: false, error: "Indikator milestone minimal 5 karakter." }, { status: 400 });
      if (!body.age_group || !USIA_MILESTONE.includes(body.age_group)) {
        return NextResponse.json({ ok: false, error: `Kelompok usia harus salah satu: ${USIA_MILESTONE.join(", ")}.` }, { status: 400 });
      }
      if (!body.aspect || !ASPEK_MILESTONE.includes(body.aspect)) {
        return NextResponse.json({ ok: false, error: `Aspek harus salah satu: ${ASPEK_MILESTONE.join(", ")}.` }, { status: 400 });
      }
      if (body.montessori_area && !AREA_MATERIAL.includes(body.montessori_area)) {
        return NextResponse.json({ ok: false, error: "Area Montessori tidak dikenal." }, { status: 400 });
      }
      const kembar = await query<{ id: string }>(
        "SELECT id FROM milestones WHERE lower(btrim(indikator)) = lower($1) AND age_group = $2",
        [indikator, body.age_group]
      );
      if (kembar.length > 0) return NextResponse.json({ ok: false, error: "Indikator yang sama sudah ada di kelompok usia itu." }, { status: 409 });
      const rows = await query<{ id: string }>(
        "INSERT INTO milestones (indikator, age_group, aspect, montessori_area, status) VALUES ($1,$2,$3,$4,'draf') RETURNING id",
        [indikator, body.age_group, body.aspect, body.montessori_area || null]
      );
      await catatAudit(denied.user, { action: "milestone.create", entityTable: "milestones", entityId: rows[0].id, detail: { indikator, usia: body.age_group } });
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    if (body.kind === "event_create") {
      const judul = (body.title || "").trim();
      const KATEGORI = ["pembelajaran", "perayaan", "libur", "olahraga", "seni", "kunjungan", "rapat", "lainnya"];
      if (!body.branch_id) return NextResponse.json({ ok: false, error: "Cabang wajib dipilih." }, { status: 400 });
      if (judul.length < 3) return NextResponse.json({ ok: false, error: "Judul kegiatan minimal 3 karakter." }, { status: 400 });
      if (!body.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.event_date)) {
        return NextResponse.json({ ok: false, error: "Tanggal kegiatan wajib diisi dengan benar." }, { status: 400 });
      }
      const kategori = body.category && KATEGORI.includes(body.category) ? body.category : "pembelajaran";
      const jam = (v?: string) => (v && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null);
      const rows = await query<{ id: string }>(
        `INSERT INTO school_events (branch_id, class_id, title, category, description, event_date, start_time, end_time, location, is_holiday, created_by)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::date, $7::time, $8::time, $9, $10,
                 (SELECT id FROM staff WHERE user_id = $11::uuid LIMIT 1)) RETURNING id`,
        [body.branch_id, body.class_id || null, judul, kategori, (body.description || "").trim() || null,
         body.event_date, jam(body.start_time), jam(body.end_time), (body.location || "").trim() || null,
         Boolean(body.is_holiday), denied.user.id]
      );
      await catatAudit(denied.user, { action: "event.create", entityTable: "school_events", entityId: rows[0].id, branchId: body.branch_id, detail: { judul, tanggal: body.event_date, kategori } });
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    if (body.kind === "event_delete") {
      if (!body.id) return NextResponse.json({ ok: false, error: "ID kegiatan wajib ada." }, { status: 400 });
      const lama = await query<{ title: string; branch_id: string }>("SELECT title, branch_id FROM school_events WHERE id = $1::uuid", [body.id]);
      if (!lama[0]) return NextResponse.json({ ok: false, error: "Kegiatan tidak ditemukan." }, { status: 404 });
      await query("DELETE FROM school_events WHERE id = $1::uuid", [body.id]);
      await catatAudit(denied.user, { action: "event.delete", entityTable: "school_events", entityId: body.id, branchId: lama[0].branch_id, detail: { judul: lama[0].title } });
      return NextResponse.json({ ok: true });
    }

    if (body.kind === "milestone_aktifkan_semua") {
      const rows = await query<{ id: string }>("UPDATE milestones SET status = 'aktif' WHERE status = 'draf' RETURNING id");
      await catatAudit(denied.user, { action: "milestone.aktifkan_semua", entityTable: "milestones", detail: { jumlah: rows.length } });
      return NextResponse.json({ ok: true, jumlah: rows.length });
    }

    if (body.kind === "milestone_status") {
      if (!body.id || !body.status || !["draf", "aktif", "arsip"].includes(body.status)) {
        return NextResponse.json({ ok: false, error: "Status harus draf, aktif, atau arsip." }, { status: 400 });
      }
      const rows = await query<{ id: string }>("UPDATE milestones SET status = $2 WHERE id = $1 RETURNING id", [body.id, body.status]);
      if (rows.length === 0) return NextResponse.json({ ok: false, error: "Milestone tidak ditemukan." }, { status: 404 });
      await catatAudit(denied.user, { action: "milestone.status", entityTable: "milestones", entityId: body.id, detail: { status: body.status } });
      return NextResponse.json({ ok: true });
    }

    // ---------- Pemetaan material <-> milestone ----------
    if (body.kind === "mapping_add" || body.kind === "mapping_remove") {
      if (!body.material_id || !body.milestone_id) {
        return NextResponse.json({ ok: false, error: "material_id dan milestone_id wajib." }, { status: 400 });
      }
      if (body.kind === "mapping_add") {
        await query("INSERT INTO material_milestones (material_id, milestone_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [body.material_id, body.milestone_id]);
      } else {
        await query("DELETE FROM material_milestones WHERE material_id = $1 AND milestone_id = $2", [body.material_id, body.milestone_id]);
      }
      await catatAudit(denied.user, {
        action: body.kind === "mapping_add" ? "material_milestone.add" : "material_milestone.remove",
        entityTable: "material_milestones",
        entityId: body.material_id,
        detail: { milestone_id: body.milestone_id },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "kind harus 'cycle', 'stppa', 'stppa_import', 'material_create', 'material_toggle', 'milestone_create', 'milestone_status', 'mapping_add', atau 'mapping_remove'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
