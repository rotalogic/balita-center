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
    const [cycles, stppa, classes, branches] = await Promise.all([
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
    ]);
    return NextResponse.json({
      ok: true,
      cycles,
      stppa: (stppa as Array<Record<string, unknown>>).map((r) => ({ ...r, aspect_label: labelAspek(String(r.aspect)) })),
      classes,
      branches,
      aspects: ASPEK_STPPA,
      ageGroups: KELOMPOK_USIA,
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
};

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

    return NextResponse.json({ ok: false, error: "kind harus 'cycle', 'stppa', atau 'stppa_import'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
