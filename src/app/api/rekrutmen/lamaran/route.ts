import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const ALUR = ["masuk", "tersaring", "wawancara", "observasi", "diterima", "ditolak", "onboarding"];

// Lamaran masuk (dari formulir lamaran internal/website). CV wajib ada.
// Penyaringan otomatis atas syarat mutlak: satu saja tidak terpenuhi,
// lamaran langsung berstatus tidak memenuhi dan tidak masuk alur seleksi.
export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nama = String(body.nama || "").trim();
    const cvNama = String(body.cv_nama || "").trim();
    if (nama.length < 2) return NextResponse.json({ ok: false, error: "Nama pelamar wajib diisi." }, { status: 400 });
    if (!cvNama) return NextResponse.json({ ok: false, error: "CV wajib dilampirkan pada lamaran." }, { status: 400 });
    const low = await query<{ id: string; syarat_mutlak: string[]; pertanyaan: string[]; status: string }>(
      "SELECT id, syarat_mutlak, pertanyaan, status FROM lowongan WHERE id = $1",
      [String(body.lowongan_id || "")]
    );
    if (low.length === 0) return NextResponse.json({ ok: false, error: "Lowongan tidak ditemukan." }, { status: 404 });
    if (low[0].status !== "buka") return NextResponse.json({ ok: false, error: "Lowongan sudah ditutup." }, { status: 400 });
    const syarat = (body.syarat || {}) as Record<string, boolean>;
    const mutlak = low[0].syarat_mutlak || [];
    const tidakTerpenuhi = mutlak.filter((s) => syarat[s] !== true);
    const jawaban = (Array.isArray(body.jawaban) ? body.jawaban : []).map((j) => String(j || ""));
    if (String(jawaban[0] || "").trim().length < 10) {
      return NextResponse.json(
        { ok: false, error: "Pertanyaan penyaring pertama wajib dijawab dengan sungguh-sungguh (alasan kuat dan motivasi bekerja di lembaga ini)." },
        { status: 400 }
      );
    }
    const status = tidakTerpenuhi.length > 0 ? "tidak_memenuhi" : "masuk";
    const rows = await query<{ id: string }>(
      `INSERT INTO lamaran (lowongan_id, nama, email, wa_number, cv_nama, cv_url, syarat, jawaban, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) RETURNING id`,
      [
        low[0].id, nama,
        body.email ? String(body.email) : null,
        body.wa_number ? String(body.wa_number) : null,
        cvNama, body.cv_url ? String(body.cv_url) : null,
        JSON.stringify(syarat), JSON.stringify(jawaban), status,
      ]
    );
    return NextResponse.json({ ok: true, id: rows[0].id, status, tidak_terpenuhi: tidakTerpenuhi });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal menyimpan lamaran.") }, { status: 500 });
  }
}

// Majukan status lamaran mengikuti alur seleksi.
export async function PATCH(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const status = String(body.status || "");
    if (!ALUR.includes(status)) return NextResponse.json({ ok: false, error: "Status alur tidak dikenal." }, { status: 400 });
    const kini = await query<{ status: string }>("SELECT status FROM lamaran WHERE id = $1", [String(body.id || "")]);
    if (kini.length === 0) return NextResponse.json({ ok: false, error: "Lamaran tidak ditemukan." }, { status: 404 });
    if (kini[0].status === "tidak_memenuhi") {
      return NextResponse.json(
        { ok: false, error: "Lamaran tidak memenuhi syarat mutlak — penyaringan otomatis menutup alurnya." },
        { status: 409 }
      );
    }
    await query(
      "UPDATE lamaran SET status = $2, catatan = COALESCE($3, catatan), updated_at = now() WHERE id = $1",
      [String(body.id), status, body.catatan ? String(body.catatan) : null]
    );
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal memperbarui lamaran.") }, { status: 500 });
  }
}
