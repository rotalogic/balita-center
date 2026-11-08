import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard, hasPermission } from "@/lib/current-user";
import { analisaPerkembangan, draftLaporanHarian } from "@/lib/ailsa/generate";
import { llmConfigured, segarkanKonfigurasi } from "@/lib/ailsa/llm";

export const dynamic = "force-dynamic";

// Ailsa menghasilkan DRAFT laporan harian atau ANALISA perkembangan.
// Dua-duanya hanya untuk staf (RBAC), dan draf tidak pernah terbit sendiri.
export async function POST(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  if (!hasPermission(denied.user, "daily_reports.create") && !hasPermission(denied.user, "students.view")) {
    return NextResponse.json({ ok: false, error: "Anda tidak berhak membuat laporan/analisa." }, { status: 403 });
  }
  await segarkanKonfigurasi();
  if (!llmConfigured()) {
    return NextResponse.json({ ok: false, error: "Otak LLM belum dikonfigurasi. Isi kunci DeepSeek di kartu Kunci LLM pada halaman Ailsa." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      child_id?: string;
      tanggal?: string;
      catatan?: string;
      dari?: string;
      sampai?: string;
    };
    if (!body.child_id) return NextResponse.json({ ok: false, error: "Pilih anak dulu." }, { status: 400 });

    const staf = await query<{ id: string }>(
      "SELECT id FROM staff WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2)) ORDER BY (user_id = $1) DESC LIMIT 1",
      [denied.user.id, denied.user.email]
    );

    if (body.action === "draft_laporan") {
      if (!body.catatan || body.catatan.trim().length < 10) {
        return NextResponse.json({ ok: false, error: "Catatan guru minimal 10 karakter supaya draf tidak mengarang." }, { status: 400 });
      }
      const hasil = await draftLaporanHarian({
        childId: body.child_id,
        tanggal: body.tanggal || new Date().toISOString().slice(0, 10),
        catatan: body.catatan.trim(),
        staffId: staf[0]?.id || null,
        userId: denied.user.id,
      });
      return NextResponse.json(hasil, { status: hasil.ok ? 200 : hasil.ditahan ? 422 : 400 });
    }

    if (body.action === "analisa") {
      const akhir = body.sampai || new Date().toISOString().slice(0, 10);
      const mulai = body.dari || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const hasil = await analisaPerkembangan({ childId: body.child_id, dari: mulai, sampai: akhir, userId: denied.user.id });
      return NextResponse.json(hasil, { status: hasil.ok ? 200 : hasil.ditahan ? 422 : 400 });
    }

    return NextResponse.json({ ok: false, error: "action harus 'draft_laporan' atau 'analisa'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message || "Gagal memproses." }, { status: 500 });
  }
}

// Daftar artefak analisa yang tersimpan (untuk ditinjau guru).
export async function GET(request: Request) {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const url = new URL(request.url);
    const childId = url.searchParams.get("child_id") || "";
    const rows = await query(
      `SELECT a.id, a.child_id, c.full_name AS child_name, a.period_start, a.period_end,
              a.published_count, a.content, a.model, a.needs_teacher_review, a.created_at
         FROM ailsa_analyses a JOIN children c ON c.id = a.child_id
        WHERE ($1::uuid IS NULL OR a.child_id = $1::uuid)
        ORDER BY a.created_at DESC LIMIT 30`,
      [childId || null]
    );
    return NextResponse.json({ ok: true, analyses: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 503 });
  }
}
