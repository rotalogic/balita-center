import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { aspekDari, labelAspek } from "@/lib/stppa";

export const dynamic = "force-dynamic";

const KELOMPOK_USIA = ["0-1 tahun", "1-2 tahun", "2-3 tahun", "3-4 tahun", "4-5 tahun", "5-6 tahun"];

// kind dikirim lewat query (?kind=cycle) agar satu route melayani dua tabel.
function tabel(kind: string | null) {
  if (kind === "cycle") return "learning_cycles";
  if (kind === "stppa") return "stppa_items";
  return null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const table = tabel(new URL(request.url).searchParams.get("kind"));
    if (!table) {
      return NextResponse.json({ ok: false, error: "kind harus 'cycle' atau 'stppa'." }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    const values: unknown[] = [params.id];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (table === "learning_cycles") {
      if (body.theme !== undefined) {
        const tema = String(body.theme).trim();
        if (tema.length < 3) return NextResponse.json({ ok: false, error: "Tema minimal 3 karakter." }, { status: 400 });
        add("theme", tema);
      }
      if (body.start_date !== undefined) add("start_date", body.start_date);
      if (body.end_date !== undefined) add("end_date", body.end_date);
      if (body.class_id !== undefined) add("class_id", body.class_id);
    } else {
      if (body.item_text !== undefined) {
        const teks = String(body.item_text).trim();
        if (teks.length < 5) return NextResponse.json({ ok: false, error: "Butir minimal 5 karakter." }, { status: 400 });
        add("item_text", teks);
      }
      if (body.age_group !== undefined) {
        const usia = String(body.age_group).trim();
        if (!KELOMPOK_USIA.includes(usia)) {
          return NextResponse.json(
            { ok: false, error: `Kelompok usia harus salah satu: ${KELOMPOK_USIA.join(", ")}.` },
            { status: 400 }
          );
        }
        add("age_group", usia);
      }
      if (body.aspect !== undefined) {
        const aspek = aspekDari(String(body.aspect));
        if (!aspek) {
          return NextResponse.json({ ok: false, error: `Aspek "${body.aspect}" tidak dikenal.` }, { status: 400 });
        }
        add("aspect", aspek);
      }
      if (body.sort_order !== undefined) add("sort_order", Number(body.sort_order) || 0);
      // Nonaktifkan bukan hapus: riwayat stppa_assessments tetap menunjuk butirnya.
      if (body.is_active !== undefined) add("is_active", Boolean(body.is_active));
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada perubahan." }, { status: 400 });
    }

    await query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = $1`, values);
    await catatAudit(denied.user, {
      action: table === "learning_cycles" ? "cycle.edit" : "stppa.edit",
      entityTable: table,
      entityId: params.id,
      detail: body.aspect !== undefined ? { ...body, aspek: labelAspek(String(body.aspect)) } : body,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const table = tabel(new URL(request.url).searchParams.get("kind"));
    if (!table) {
      return NextResponse.json({ ok: false, error: "kind harus 'cycle' atau 'stppa'." }, { status: 400 });
    }
    if (table === "learning_cycles") {
      const dipakai = await query<{ total: number }>(
        "SELECT count(*)::int AS total FROM cycle_reports WHERE cycle_id = $1",
        [params.id]
      );
      if ((dipakai[0]?.total || 0) > 0) {
        return NextResponse.json(
          { ok: false, error: "Siklus ini sudah punya laporan anak, tidak bisa dihapus." },
          { status: 409 }
        );
      }
    } else {
      // Butir yang sudah dinilai tidak boleh hilang — nonaktifkan saja.
      const dinilai = await query<{ total: number }>(
        "SELECT count(*)::int AS total FROM stppa_assessments WHERE item_id = $1",
        [params.id]
      );
      if ((dinilai[0]?.total || 0) > 0) {
        return NextResponse.json(
          { ok: false, error: "Butir ini sudah dipakai penilaian anak. Nonaktifkan saja, jangan dihapus." },
          { status: 409 }
        );
      }
    }
    await query(`DELETE FROM ${table} WHERE id = $1`, [params.id]);
    await catatAudit(denied.user, {
      action: table === "learning_cycles" ? "cycle.delete" : "stppa.delete",
      entityTable: table,
      entityId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 500 });
  }
}
