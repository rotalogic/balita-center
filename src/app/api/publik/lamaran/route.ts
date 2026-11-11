import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Formulir lamaran lengkap pada halaman Karier website — tersambung masuk
// ke modul Rekrutmen: penyaringan otomatis atas syarat mutlak berjalan
// sama seperti di dalam sistem, beserta berkas CV dan jawaban saringannya.
// Data pelamar tidak pernah ditampilkan kembali pada halaman publik.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (String(body.situs_web || "")) return NextResponse.json({ ok: true });
    const nama = String(body.nama || "").trim();
    if (nama.length < 2) return NextResponse.json({ ok: false, error: "Nama pelamar wajib diisi." }, { status: 400 });
    if (!String(body.cv_nama || "").trim()) {
      return NextResponse.json({ ok: false, error: "CV wajib dilampirkan pada lamaran." }, { status: 400 });
    }
    const low = await query<{ id: string; syarat_mutlak: string[]; status: string }>(
      "SELECT id, syarat_mutlak, status FROM lowongan WHERE id = $1",
      [String(body.lowongan_id || "")]
    );
    if (low.length === 0) return NextResponse.json({ ok: false, error: "Posisi tidak ditemukan." }, { status: 404 });
    if (low[0].status !== "buka") return NextResponse.json({ ok: false, error: "Posisi sudah ditutup." }, { status: 400 });
    const syarat = (body.syarat || {}) as Record<string, boolean>;
    const tidakTerpenuhi = (low[0].syarat_mutlak || []).filter((s) => syarat[s] !== true);
    const jawaban = (Array.isArray(body.jawaban) ? body.jawaban : []).map((j) => String(j || ""));
    if (String(jawaban[0] || "").trim().length < 10) {
      return NextResponse.json(
        { ok: false, error: "Pertanyaan pertama wajib dijawab dengan sungguh-sungguh: alasan kuat dan motivasi Anda ingin bekerja di lembaga ini." },
        { status: 400 }
      );
    }
    const status = tidakTerpenuhi.length > 0 ? "tidak_memenuhi" : "masuk";
    const identitas = [
      body.pendidikan ? `Pendidikan: ${String(body.pendidikan)}` : "",
      body.pengalaman ? `Pengalaman: ${String(body.pengalaman)}` : "",
    ].filter(Boolean).join("\n") || null;
    const rows = await query<{ id: string }>(
      `INSERT INTO lamaran (lowongan_id, nama, email, wa_number, cv_nama, cv_url, syarat, jawaban, status, catatan)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10) RETURNING id`,
      [
        low[0].id, nama,
        body.email ? String(body.email) : null,
        body.wa_number ? String(body.wa_number) : null,
        String(body.cv_nama), body.cv_url ? String(body.cv_url) : null,
        JSON.stringify(syarat), JSON.stringify(jawaban), status,
        identitas ? `Lamaran dari halaman Karier website.\n${identitas}` : "Lamaran dari halaman Karier website.",
      ]
    );
    await query(
      `INSERT INTO notifications (user_id, title, body, href)
       SELECT DISTINCT u.id, 'Lamaran baru dari website Karier', $1, '/sdm/rekrutmen'
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.role IN ('owner','super_admin') OR r.code IN ('owner','super_admin')`,
      [`${nama} melamar lewat halaman Karier website (status awal: ${status === "masuk" ? "masuk alur seleksi" : "tidak memenuhi syarat mutlak"}).`]
    ).catch(() => undefined);
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengirim lamaran.") }, { status: 500 });
  }
}
