import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { PERTANYAAN_PERTAMA } from "@/lib/tahap4";

export const dynamic = "force-dynamic";

// Modul Rekrutmen: lowongan per program + lamaran yang mengalir pada alur
// masuk → tersaring → wawancara → observasi mengajar → keputusan → onboarding.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  try {
    const [lowongan, lamaran] = await Promise.all([
      query("SELECT * FROM lowongan ORDER BY created_at DESC"),
      query(
        `SELECT l.*, lw.judul AS lowongan_judul FROM lamaran l
           JOIN lowongan lw ON lw.id = l.lowongan_id ORDER BY l.created_at DESC LIMIT 300`
      ),
    ]);
    return NextResponse.json({ ok: true, lowongan, lamaran });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Buat lowongan. Pertanyaan penyaring pertama selalu bunyi resmi lembaga
// dan dikunci di urutan pertama.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const judul = String(body.judul || "").trim();
    if (judul.length < 3) return NextResponse.json({ ok: false, error: "Judul lowongan wajib diisi." }, { status: 400 });
    const tambahan = (Array.isArray(body.pertanyaan) ? body.pertanyaan : [])
      .map((p) => String(p).trim()).filter((p) => p && p !== PERTANYAAN_PERTAMA);
    const rows = await query<{ id: string }>(
      `INSERT INTO lowongan (branch_id, judul, program_label, deskripsi, syarat_mutlak, pertanyaan)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id`,
      [
        body.branch_id ? String(body.branch_id) : null,
        judul,
        body.program_label ? String(body.program_label) : null,
        body.deskripsi ? String(body.deskripsi) : null,
        JSON.stringify(Array.isArray(body.syarat_mutlak) ? body.syarat_mutlak.map((s) => String(s)) : []),
        JSON.stringify([PERTANYAAN_PERTAMA, ...tambahan].slice(0, 4)),
      ]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat lowongan.") }, { status: 500 });
  }
}
